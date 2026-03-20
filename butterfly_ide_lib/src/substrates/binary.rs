use super::{ReadSubstrate, Substrate, SubstrateId, SubstrateKind, WriteSubstrate};
use crate::{
    identity::{Coordinate, CoordinateId, Scalar},
    manifold::Manifold,
};

const FLOAT_TOLERANCE: Scalar = 1e-10;

pub const BINARY_READ_SUBSTRATE_ID: SubstrateId = "binary.read";
pub const BINARY_WRITE_SUBSTRATE_ID: SubstrateId = "binary.write";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BinaryCoordinateSpec {
    pub coordinate_id: CoordinateId,
    pub byte: u8,
    pub ordinal: usize,
}

impl BinaryCoordinateSpec {
    pub fn new(coordinate_id: CoordinateId, byte: u8, ordinal: usize) -> Self {
        Self {
            coordinate_id,
            byte,
            ordinal,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct BinaryByteProjection {
    pub byte: u8,
    pub ordinal: usize,
    pub sample: Scalar,
}

#[derive(Debug, Default, Clone, Copy)]
pub struct BinaryReadSubstrate;

impl BinaryReadSubstrate {
    pub fn new() -> Self {
        Self
    }

    pub fn collapse_bytes(
        &self,
        manifold: &dyn Manifold,
        coordinates: &[Coordinate],
    ) -> Option<Vec<u8>> {
        let mut bytes = coordinates
            .iter()
            .map(|coordinate| self.read(manifold, coordinate))
            .collect::<Option<Vec<_>>>()?;

        bytes.sort_by_key(|projection| projection.ordinal);
        Some(bytes.into_iter().map(|projection| projection.byte).collect())
    }
}

impl Substrate for BinaryReadSubstrate {
    fn id(&self) -> SubstrateId {
        BINARY_READ_SUBSTRATE_ID
    }

    fn kind(&self) -> SubstrateKind {
        SubstrateKind::Read
    }

    fn domain(&self) -> &'static str {
        "binary"
    }
}

impl ReadSubstrate for BinaryReadSubstrate {
    type Output = Option<BinaryByteProjection>;

    fn read(&self, manifold: &dyn Manifold, coordinate: &Coordinate) -> Self::Output {
        let byte = decode_byte_axis(coordinate.axis(0)?)?;
        let ordinal = decode_position_axis(coordinate.axis(1)?)?;

        Some(BinaryByteProjection {
            byte,
            ordinal,
            sample: manifold.sample(coordinate),
        })
    }
}

#[derive(Debug, Default, Clone, Copy)]
pub struct BinaryWriteSubstrate;

impl BinaryWriteSubstrate {
    pub fn new() -> Self {
        Self
    }
}

impl Substrate for BinaryWriteSubstrate {
    fn id(&self) -> SubstrateId {
        BINARY_WRITE_SUBSTRATE_ID
    }

    fn kind(&self) -> SubstrateKind {
        SubstrateKind::Write
    }

    fn domain(&self) -> &'static str {
        "binary"
    }
}

impl WriteSubstrate for BinaryWriteSubstrate {
    type Input = BinaryCoordinateSpec;

    fn create(&self, manifold: &dyn Manifold, input: Self::Input) -> Coordinate {
        let byte_axis = input.byte as Scalar;
        let position_axis = input.ordinal as Scalar + 1.0;
        let seed = Coordinate::new(input.coordinate_id, [byte_axis, position_axis]);
        let sample = manifold.sample(&seed);

        Coordinate::new(input.coordinate_id, [byte_axis, position_axis, sample])
    }
}

fn decode_byte_axis(value: Scalar) -> Option<u8> {
    let rounded = decode_integral_scalar(value)?;
    (rounded <= u8::MAX as Scalar).then_some(rounded as u8)
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
    use super::{BinaryCoordinateSpec, BinaryReadSubstrate, BinaryWriteSubstrate};
    use crate::{identity::Coordinate, manifold::HelixManifold, ReadSubstrate, WriteSubstrate};

    #[test]
    fn binary_write_substrate_encodes_byte_and_position() {
        let manifold = HelixManifold::new();
        let substrate = BinaryWriteSubstrate::new();

        let coordinate = substrate.create(&manifold, BinaryCoordinateSpec::new(30, 255, 1));

        assert_eq!(coordinate.axes, vec![255.0, 2.0, 510.0]);
    }

    #[test]
    fn binary_read_substrate_decodes_byte_projection() {
        let manifold = HelixManifold::new();
        let coordinate = Coordinate::new(31, [65.0, 1.0, 65.0]);
        let projection = BinaryReadSubstrate::new()
            .read(&manifold, &coordinate)
            .expect("binary projection to decode");

        assert_eq!(projection.byte, 65);
        assert_eq!(projection.ordinal, 0);
        assert_eq!(projection.sample, 65.0);
    }

    #[test]
    fn collapse_orders_bytes_into_buffer() {
        let manifold = HelixManifold::new();
        let writer = BinaryWriteSubstrate::new();
        let reader = BinaryReadSubstrate::new();
        let second = writer.create(&manifold, BinaryCoordinateSpec::new(32, 66, 1));
        let first = writer.create(&manifold, BinaryCoordinateSpec::new(33, 65, 0));

        let collapsed = reader
            .collapse_bytes(&manifold, &[second, first])
            .expect("binary collapse to succeed");

        assert_eq!(collapsed, vec![65, 66]);
    }

    #[test]
    fn invalid_binary_coordinate_is_rejected() {
        let manifold = HelixManifold::new();
        let coordinate = Coordinate::new(34, [300.0, 1.5]);

        assert!(BinaryReadSubstrate::new().read(&manifold, &coordinate).is_none());
    }
}