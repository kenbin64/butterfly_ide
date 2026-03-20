pub type Scalar = f64;
pub type DimensionIndex = u8;
pub type CoordinateId = u128;
pub type IdentityId = u128;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DimensionalStage {
    Point,
    Line,
    Plane,
    Volume,
    Whole,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DimensionalPerspective {
    Point,
    Whole,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CoordinatePerspective {
    pub coordinate_id: CoordinateId,
    pub dimensionality: Dimensionality,
    pub stage: DimensionalStage,
    pub perspective: DimensionalPerspective,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DimensionalPromotion {
    pub source_coordinate: CoordinateId,
    pub source_dimensionality: Dimensionality,
    pub source_stage: DimensionalStage,
    pub target_dimensionality: Dimensionality,
    pub target_perspective: DimensionalPerspective,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Coordinate {
    pub id: CoordinateId,
    pub axes: Vec<Scalar>,
}

impl Coordinate {
    pub fn new(id: CoordinateId, axes: impl Into<Vec<Scalar>>) -> Self {
        Self {
            id,
            axes: axes.into(),
        }
    }

    pub fn dimensionality(&self) -> Dimensionality {
        Dimensionality(self.axes.len() as DimensionIndex)
    }

    pub fn stage(&self) -> DimensionalStage {
        self.dimensionality().stage()
    }

    pub fn axis(&self, index: usize) -> Option<Scalar> {
        self.axes.get(index).copied()
    }

    pub fn as_point(&self) -> CoordinatePerspective {
        CoordinatePerspective {
            coordinate_id: self.id,
            dimensionality: self.dimensionality(),
            stage: self.stage(),
            perspective: DimensionalPerspective::Point,
        }
    }

    pub fn as_whole(&self) -> CoordinatePerspective {
        CoordinatePerspective {
            coordinate_id: self.id,
            dimensionality: self.dimensionality(),
            stage: self.stage(),
            perspective: DimensionalPerspective::Whole,
        }
    }

    pub fn whole_as_point_in_next_dimension(&self) -> DimensionalPromotion {
        DimensionalPromotion {
            source_coordinate: self.id,
            source_dimensionality: self.dimensionality(),
            source_stage: self.stage(),
            target_dimensionality: self.dimensionality().next(),
            target_perspective: DimensionalPerspective::Point,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Dimensionality(pub DimensionIndex);

impl Dimensionality {
    pub fn as_usize(self) -> usize {
        self.0 as usize
    }

    pub fn stage(self) -> DimensionalStage {
        match self.0 {
            0 | 1 => DimensionalStage::Point,
            2 => DimensionalStage::Line,
            3 => DimensionalStage::Plane,
            4 => DimensionalStage::Volume,
            _ => DimensionalStage::Whole,
        }
    }

    pub fn next(self) -> Self {
        Self(self.0.saturating_add(1))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Identity {
    pub id: IdentityId,
    pub label: String,
    pub primary_coordinate: CoordinateId,
}

impl Identity {
    pub fn new(id: IdentityId, label: impl Into<String>, primary_coordinate: CoordinateId) -> Self {
        Self {
            id,
            label: label.into(),
            primary_coordinate,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{
        Coordinate, DimensionalPerspective, DimensionalStage, Dimensionality, Identity,
    };

    #[test]
    fn coordinate_reports_dimensionality() {
        let coordinate = Coordinate::new(7, [1.0, 2.0, 3.0]);

        assert_eq!(coordinate.dimensionality(), Dimensionality(3));
        assert_eq!(coordinate.stage(), DimensionalStage::Plane);
        assert_eq!(coordinate.axis(1), Some(2.0));
    }

    #[test]
    fn coordinate_has_point_and_whole_perspectives() {
        let coordinate = Coordinate::new(8, [1.0, 2.0, 3.0, 4.0, 5.0]);

        assert_eq!(coordinate.as_point().perspective, DimensionalPerspective::Point);
        assert_eq!(coordinate.as_whole().perspective, DimensionalPerspective::Whole);
        assert_eq!(coordinate.as_whole().stage, DimensionalStage::Whole);
    }

    #[test]
    fn whole_promotes_to_point_in_next_dimension() {
        let coordinate = Coordinate::new(10, [1.0, 2.0, 3.0, 4.0, 5.0]);
        let promotion = coordinate.whole_as_point_in_next_dimension();

        assert_eq!(promotion.source_coordinate, 10);
        assert_eq!(promotion.source_stage, DimensionalStage::Whole);
        assert_eq!(promotion.target_dimensionality, Dimensionality(6));
        assert_eq!(promotion.target_perspective, DimensionalPerspective::Point);
    }

    #[test]
    fn identity_keeps_primary_coordinate() {
        let identity = Identity::new(9, "workspace-root", 42);

        assert_eq!(identity.primary_coordinate, 42);
        assert_eq!(identity.label, "workspace-root");
    }
}
