use super::{ReadSubstrate, Substrate, SubstrateId, SubstrateKind, WriteSubstrate};
use crate::{
    identity::{Coordinate, CoordinateId, Scalar},
    manifold::Manifold,
};

const FLOAT_TOLERANCE: Scalar = 1e-10;

pub const TEXT_READ_SUBSTRATE_ID: SubstrateId = "text.read";
pub const TEXT_WRITE_SUBSTRATE_ID: SubstrateId = "text.write";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TextCoordinateSpec {
    pub coordinate_id: CoordinateId,
    pub symbol: char,
    pub ordinal: usize,
}

impl TextCoordinateSpec {
    pub fn new(coordinate_id: CoordinateId, symbol: char, ordinal: usize) -> Self {
        Self {
            coordinate_id,
            symbol,
            ordinal,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct TextSymbolProjection {
    pub symbol: char,
    pub ordinal: usize,
    pub sample: Scalar,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct TextReadSubstrate;

impl TextReadSubstrate {
    pub fn new() -> Self {
        Self
    }

    pub fn collapse_ordered(
        &self,
        manifold: &dyn Manifold,
        coordinates: &[Coordinate],
    ) -> Option<String> {
        let mut symbols = coordinates
            .iter()
            .map(|coordinate| self.read(manifold, coordinate))
            .collect::<Option<Vec<_>>>()?;

        symbols.sort_by_key(|projection| projection.ordinal);
        Some(symbols.into_iter().map(|projection| projection.symbol).collect())
    }
}

impl Substrate for TextReadSubstrate {
    fn id(&self) -> SubstrateId {
        TEXT_READ_SUBSTRATE_ID
    }

    fn kind(&self) -> SubstrateKind {
        SubstrateKind::Read
    }

    fn domain(&self) -> &'static str {
        "text"
    }
}

impl ReadSubstrate for TextReadSubstrate {
    type Output = Option<TextSymbolProjection>;

    fn read(&self, manifold: &dyn Manifold, coordinate: &Coordinate) -> Self::Output {
        let symbol = decode_symbol_axis(coordinate.axis(0)?)?;
        let ordinal = decode_position_axis(coordinate.axis(1)?)?;

        Some(TextSymbolProjection {
            symbol,
            ordinal,
            sample: manifold.sample(coordinate),
        })
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct TextWriteSubstrate;

impl TextWriteSubstrate {
    pub fn new() -> Self {
        Self
    }
}

impl Substrate for TextWriteSubstrate {
    fn id(&self) -> SubstrateId {
        TEXT_WRITE_SUBSTRATE_ID
    }

    fn kind(&self) -> SubstrateKind {
        SubstrateKind::Write
    }

    fn domain(&self) -> &'static str {
        "text"
    }
}

impl WriteSubstrate for TextWriteSubstrate {
    type Input = TextCoordinateSpec;

    fn create(&self, manifold: &dyn Manifold, input: Self::Input) -> Coordinate {
        let symbol_axis = input.symbol as u32 as Scalar;
        let position_axis = input.ordinal as Scalar + 1.0;
        let seed = Coordinate::new(input.coordinate_id, [symbol_axis, position_axis]);
        let sample = manifold.sample(&seed);

        Coordinate::new(input.coordinate_id, [symbol_axis, position_axis, sample])
    }
}

fn decode_symbol_axis(value: Scalar) -> Option<char> {
    let rounded = decode_integral_scalar(value)?;
    char::from_u32(rounded as u32)
}

fn decode_position_axis(value: Scalar) -> Option<usize> {
    let rounded = decode_integral_scalar(value)?;
    (rounded >= 1.0).then_some(rounded as usize - 1)
}

fn decode_integral_scalar(value: Scalar) -> Option<Scalar> {
    if !value.is_finite() {
        return None;
    }

    let rounded = value.round();
    ((value - rounded).abs() < FLOAT_TOLERANCE && rounded >= 0.0).then_some(rounded)
}

#[cfg(test)]
mod tests {
    use super::{TextCoordinateSpec, TextReadSubstrate, TextWriteSubstrate};
    use crate::{identity::Coordinate, manifold::HelixManifold, ReadSubstrate, WriteSubstrate};

    #[test]
    fn text_write_substrate_encodes_symbol_and_position() {
        let manifold = HelixManifold::new();
        let substrate = TextWriteSubstrate::new();

        let coordinate = substrate.create(&manifold, TextCoordinateSpec::new(7, 'A', 0));

        assert_eq!(coordinate.axes, vec![65.0, 1.0, 65.0]);
    }

    #[test]
    fn text_read_substrate_decodes_symbol_projection() {
        let manifold = HelixManifold::new();
        let coordinate = Coordinate::new(8, [66.0, 2.0, 132.0]);
        let projection = TextReadSubstrate::new()
            .read(&manifold, &coordinate)
            .expect("text projection to decode");

        assert_eq!(projection.symbol, 'B');
        assert_eq!(projection.ordinal, 1);
        assert_eq!(projection.sample, 132.0);
    }

    #[test]
    fn collapse_orders_symbols_into_string() {
        let manifold = HelixManifold::new();
        let writer = TextWriteSubstrate::new();
        let reader = TextReadSubstrate::new();
        let later = writer.create(&manifold, TextCoordinateSpec::new(9, 'i', 1));
        let earlier = writer.create(&manifold, TextCoordinateSpec::new(10, 'h', 0));

        let collapsed = reader
            .collapse_ordered(&manifold, &[later, earlier])
            .expect("ordered collapse to succeed");

        assert_eq!(collapsed, "hi");
    }

    #[test]
    fn invalid_text_coordinate_is_rejected() {
        let manifold = HelixManifold::new();
        let coordinate = Coordinate::new(11, [65.5, 1.0]);

        assert!(TextReadSubstrate::new().read(&manifold, &coordinate).is_none());
    }
}