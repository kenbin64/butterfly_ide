use std::collections::BTreeMap;

use super::{ReadSubstrate, Substrate, SubstrateId, SubstrateKind, WriteSubstrate};
use crate::{
    identity::{Coordinate, CoordinateId, IdentityId, Scalar},
    manifold::Manifold,
};

const FLOAT_TOLERANCE: Scalar = 1e-10;

pub const OBJECT_READ_SUBSTRATE_ID: SubstrateId = "object.read";
pub const OBJECT_WRITE_SUBSTRATE_ID: SubstrateId = "object.write";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObjectSchema {
    pub name: String,
    pub fields: Vec<String>,
}

impl ObjectSchema {
    pub fn new(
        name: impl Into<String>,
        fields: impl IntoIterator<Item = impl Into<String>>,
    ) -> Self {
        Self {
            name: name.into(),
            fields: fields.into_iter().map(Into::into).collect(),
        }
    }

    pub fn field_slot(&self, field_name: &str) -> Option<usize> {
        self.fields.iter().position(|candidate| candidate == field_name)
    }

    pub fn field_name(&self, slot: usize) -> Option<&str> {
        self.fields.get(slot).map(String::as_str)
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ObjectFieldSpec {
    pub coordinate_id: CoordinateId,
    pub field_name: String,
    pub value: Scalar,
}

impl ObjectFieldSpec {
    pub fn new(coordinate_id: CoordinateId, field_name: impl Into<String>, value: Scalar) -> Self {
        Self {
            coordinate_id,
            field_name: field_name.into(),
            value,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct ObjectFieldProjection {
    pub coordinate_id: CoordinateId,
    pub field_name: String,
    pub field_slot: usize,
    pub value: Scalar,
    pub sample: Scalar,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObjectFieldBinding {
    pub coordinate_id: CoordinateId,
    pub field_name: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct StructuredObjectProjection {
    pub object_identity: IdentityId,
    pub schema_name: String,
    pub fields: BTreeMap<String, Scalar>,
    pub bindings: Vec<ObjectFieldBinding>,
}

#[derive(Debug, Clone)]
pub struct StructuredObjectReadSubstrate {
    schema: ObjectSchema,
}

impl StructuredObjectReadSubstrate {
    pub fn new(schema: ObjectSchema) -> Self {
        Self { schema }
    }

    pub fn schema(&self) -> &ObjectSchema {
        &self.schema
    }

    pub fn collapse_object(
        &self,
        manifold: &dyn Manifold,
        object_identity: IdentityId,
        coordinates: &[Coordinate],
    ) -> Option<StructuredObjectProjection> {
        let mut fields = BTreeMap::new();
        let mut bindings = Vec::with_capacity(coordinates.len());

        for projection in coordinates
            .iter()
            .map(|coordinate| self.read(manifold, coordinate))
            .collect::<Option<Vec<_>>>()?
        {
            fields.insert(projection.field_name.clone(), projection.value);
            bindings.push(ObjectFieldBinding {
                coordinate_id: projection.coordinate_id,
                field_name: projection.field_name,
            });
        }

        bindings.sort_by(|left, right| left.field_name.cmp(&right.field_name));

        Some(StructuredObjectProjection {
            object_identity,
            schema_name: self.schema.name.clone(),
            fields,
            bindings,
        })
    }
}

impl Substrate for StructuredObjectReadSubstrate {
    fn id(&self) -> SubstrateId {
        OBJECT_READ_SUBSTRATE_ID
    }

    fn kind(&self) -> SubstrateKind {
        SubstrateKind::Read
    }

    fn domain(&self) -> &'static str {
        "object"
    }
}

impl ReadSubstrate for StructuredObjectReadSubstrate {
    type Output = Option<ObjectFieldProjection>;

    fn read(&self, manifold: &dyn Manifold, coordinate: &Coordinate) -> Self::Output {
        let field_slot = decode_slot_axis(coordinate.axis(0)?)?;
        let value = coordinate.axis(1)?;
        let field_name = self.schema.field_name(field_slot)?.to_string();

        Some(ObjectFieldProjection {
            coordinate_id: coordinate.id,
            field_name,
            field_slot,
            value,
            sample: manifold.sample(coordinate),
        })
    }
}

#[derive(Debug, Clone)]
pub struct StructuredObjectWriteSubstrate {
    schema: ObjectSchema,
}

impl StructuredObjectWriteSubstrate {
    pub fn new(schema: ObjectSchema) -> Self {
        Self { schema }
    }

    pub fn schema(&self) -> &ObjectSchema {
        &self.schema
    }

    pub fn try_create(&self, manifold: &dyn Manifold, input: ObjectFieldSpec) -> Option<Coordinate> {
        let field_slot = self.schema.field_slot(&input.field_name)?;
        let slot_axis = field_slot as Scalar + 1.0;
        let seed = Coordinate::new(input.coordinate_id, [slot_axis, input.value]);
        let sample = manifold.sample(&seed);

        Some(Coordinate::new(input.coordinate_id, [slot_axis, input.value, sample]))
    }
}

impl Substrate for StructuredObjectWriteSubstrate {
    fn id(&self) -> SubstrateId {
        OBJECT_WRITE_SUBSTRATE_ID
    }

    fn kind(&self) -> SubstrateKind {
        SubstrateKind::Write
    }

    fn domain(&self) -> &'static str {
        "object"
    }
}

impl WriteSubstrate for StructuredObjectWriteSubstrate {
    type Input = ObjectFieldSpec;

    fn create(&self, manifold: &dyn Manifold, input: Self::Input) -> Coordinate {
        self.try_create(manifold, input)
            .expect("object field must exist in schema")
    }
}

fn decode_slot_axis(value: Scalar) -> Option<usize> {
    if !value.is_finite() {
        return None;
    }

    let rounded = value.round();
    if (value - rounded).abs() >= FLOAT_TOLERANCE || rounded < 1.0 {
        return None;
    }

    Some(rounded as usize - 1)
}

#[cfg(test)]
mod tests {
    use super::{
        ObjectFieldSpec, ObjectSchema, StructuredObjectReadSubstrate,
        StructuredObjectWriteSubstrate,
    };
    use crate::{identity::Coordinate, manifold::HelixManifold, ReadSubstrate, WriteSubstrate};

    fn schema() -> ObjectSchema {
        ObjectSchema::new("Person", ["age", "score"])
    }

    #[test]
    fn object_write_substrate_encodes_field_slot_and_value() {
        let manifold = HelixManifold::new();
        let substrate = StructuredObjectWriteSubstrate::new(schema());

        let coordinate = substrate.create(&manifold, ObjectFieldSpec::new(20, "score", 9.5));

        assert_eq!(coordinate.axes, vec![2.0, 9.5, 19.0]);
    }

    #[test]
    fn object_read_substrate_decodes_field_projection() {
        let manifold = HelixManifold::new();
        let substrate = StructuredObjectReadSubstrate::new(schema());
        let coordinate = Coordinate::new(21, [1.0, 42.0, 42.0]);

        let projection = substrate.read(&manifold, &coordinate).expect("field to decode");

        assert_eq!(projection.coordinate_id, 21);
        assert_eq!(projection.field_name, "age");
        assert_eq!(projection.field_slot, 0);
        assert_eq!(projection.value, 42.0);
        assert_eq!(projection.sample, 42.0);
    }

    #[test]
    fn collapse_object_projects_field_map() {
        let manifold = HelixManifold::new();
        let writer = StructuredObjectWriteSubstrate::new(schema());
        let reader = StructuredObjectReadSubstrate::new(schema());
        let score = writer.create(&manifold, ObjectFieldSpec::new(22, "score", 7.5));
        let age = writer.create(&manifold, ObjectFieldSpec::new(23, "age", 33.0));

        let object = reader
            .collapse_object(&manifold, 500, &[score, age])
            .expect("object collapse to succeed");

        assert_eq!(object.object_identity, 500);
        assert_eq!(object.schema_name, "Person");
        assert_eq!(object.fields.get("age"), Some(&33.0));
        assert_eq!(object.fields.get("score"), Some(&7.5));
        assert_eq!(object.bindings.len(), 2);
    }

    #[test]
    fn create_rejects_unknown_field_when_using_safe_api() {
        let manifold = HelixManifold::new();
        let substrate = StructuredObjectWriteSubstrate::new(schema());

        assert!(substrate
            .try_create(&manifold, ObjectFieldSpec::new(24, "unknown", 1.0))
            .is_none());
    }
}