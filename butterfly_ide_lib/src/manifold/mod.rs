use crate::identity::{
    Coordinate, DimensionIndex, DimensionalPromotion, DimensionalStage, Dimensionality, Scalar,
};

pub const HELIX_TURN_DEGREES: Scalar = 360.0;
pub const HELIX_DIMENSION_STEP_DEGREES: Scalar = 90.0;
pub const FIBONACCI_ACCUMULATION_STEPS: [DimensionIndex; 8] = [1, 1, 2, 3, 5, 8, 13, 21];
pub const FIBONACCI_COLLAPSE_THRESHOLD: DimensionIndex = 21;
const FLOAT_TOLERANCE: Scalar = 1e-10;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Angle(Scalar);

impl Angle {
    pub fn new(degrees: Scalar) -> Self {
        Self(degrees.rem_euclid(HELIX_TURN_DEGREES))
    }

    pub fn degrees(self) -> Scalar {
        self.0
    }

    pub fn quantize(self, increment: Scalar) -> Self {
        if increment.abs() < FLOAT_TOLERANCE {
            return self;
        }

        Self::new((self.0 / increment).round() * increment)
    }

    pub fn quadrant(self) -> Quadrant {
        Quadrant::from_angle(self)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Quadrant {
    Zero,
    Ninety,
    OneEighty,
    TwoSeventy,
}

impl Quadrant {
    pub fn from_angle(angle: Angle) -> Self {
        let quantized = angle.quantize(HELIX_DIMENSION_STEP_DEGREES).degrees() as i32;
        match quantized {
            0 => Self::Zero,
            90 => Self::Ninety,
            180 => Self::OneEighty,
            _ => Self::TwoSeventy,
        }
    }

    pub fn pivot_offset(self) -> DimensionIndex {
        match self {
            Self::Zero => 0,
            Self::Ninety => 1,
            Self::OneEighty => 2,
            Self::TwoSeventy => 3,
        }
    }

    pub fn target_dimensionality(self, base: Dimensionality) -> Dimensionality {
        Dimensionality(base.0.saturating_add(self.pivot_offset()))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StructuralDirectives {
    pub minimal_material: bool,
    pub maximal_surface_area: bool,
    pub maximal_strength: bool,
}

impl StructuralDirectives {
    pub const HARDENED: Self = Self {
        minimal_material: true,
        maximal_surface_area: true,
        maximal_strength: true,
    };
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FibonacciAccumulation {
    pub step_index: usize,
    pub units: DimensionIndex,
    pub stage: DimensionalStage,
    pub collapse_ready: bool,
}

impl FibonacciAccumulation {
    pub fn at(step_index: usize) -> Option<Self> {
        let units = *FIBONACCI_ACCUMULATION_STEPS.get(step_index)?;
        let stage = match step_index {
            0 => DimensionalStage::Point,
            1 => DimensionalStage::Line,
            2 => DimensionalStage::Plane,
            3 => DimensionalStage::Volume,
            _ => DimensionalStage::Whole,
        };

        Some(Self {
            step_index,
            units,
            stage,
            collapse_ready: units >= FIBONACCI_COLLAPSE_THRESHOLD,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct HelixProjection {
    pub angle: Angle,
    pub quadrant: Quadrant,
    pub stage: DimensionalStage,
    pub amplitude: Scalar,
    pub sample: Scalar,
    pub target_dimensionality: Dimensionality,
}

pub trait Manifold {
    fn name(&self) -> &'static str;
    fn dimensionality(&self) -> Dimensionality;
    fn sample(&self, coordinate: &Coordinate) -> Scalar;
    fn rotate(&self, coordinate: &Coordinate, degrees: Scalar) -> Coordinate;
    fn project(&self, coordinate: &Coordinate, target: Dimensionality) -> Coordinate;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct ProductManifold;

impl ProductManifold {
    pub fn new() -> Self {
        Self
    }
}

impl Manifold for ProductManifold {
    fn name(&self) -> &'static str {
        "product-manifold"
    }

    fn dimensionality(&self) -> Dimensionality {
        Dimensionality(2)
    }

    fn sample(&self, coordinate: &Coordinate) -> Scalar {
        product_sample(coordinate)
    }

    fn rotate(&self, coordinate: &Coordinate, degrees: Scalar) -> Coordinate {
        rotate_coordinate(coordinate, degrees)
    }

    fn project(&self, coordinate: &Coordinate, target: Dimensionality) -> Coordinate {
        project_coordinate(coordinate, target)
    }
}

#[derive(Debug, Clone, Copy)]
pub struct HelixManifold {
    base_dimensionality: Dimensionality,
    dimension_step_degrees: Scalar,
}

impl Default for HelixManifold {
    fn default() -> Self {
        Self::new()
    }
}

impl HelixManifold {
    pub fn new() -> Self {
        Self {
            base_dimensionality: Dimensionality(2),
            dimension_step_degrees: HELIX_DIMENSION_STEP_DEGREES,
        }
    }

    pub fn hardening_principles(&self) -> StructuralDirectives {
        StructuralDirectives::HARDENED
    }

    pub fn quantize_angle(&self, degrees: Scalar) -> Angle {
        Angle::new(degrees).quantize(self.dimension_step_degrees)
    }

    pub fn classify(&self, coordinate: &Coordinate) -> HelixProjection {
        let x = coordinate.axis(0).unwrap_or(0.0);
        let y = coordinate.axis(1).unwrap_or(0.0);
        let angle = self.quantize_angle(y.atan2(x).to_degrees());
        let quadrant = angle.quadrant();

        HelixProjection {
            angle,
            quadrant,
            stage: coordinate.stage(),
            amplitude: (x.powi(2) + y.powi(2)).sqrt(),
            sample: product_sample(coordinate),
            target_dimensionality: quadrant.target_dimensionality(self.base_dimensionality),
        }
    }

    pub fn inherit_dimension(&self, coordinate: &Coordinate) -> Coordinate {
        let projection = self.classify(coordinate);
        project_coordinate(coordinate, projection.target_dimensionality)
    }

    pub fn fibonacci_accumulation(&self, step_index: usize) -> Option<FibonacciAccumulation> {
        FibonacciAccumulation::at(step_index)
    }

    pub fn collapse_whole_to_next_dimension(
        &self,
        coordinate: &Coordinate,
        step_index: usize,
    ) -> Option<DimensionalPromotion> {
        let accumulation = self.fibonacci_accumulation(step_index)?;
        if !accumulation.collapse_ready || coordinate.stage() != DimensionalStage::Whole {
            return None;
        }

        Some(coordinate.whole_as_point_in_next_dimension())
    }
}

impl Manifold for HelixManifold {
    fn name(&self) -> &'static str {
        "helix-manifold"
    }

    fn dimensionality(&self) -> Dimensionality {
        self.base_dimensionality
    }

    fn sample(&self, coordinate: &Coordinate) -> Scalar {
        product_sample(coordinate)
    }

    fn rotate(&self, coordinate: &Coordinate, degrees: Scalar) -> Coordinate {
        if coordinate.axes.len() < 2 {
            return coordinate.clone();
        }

        let x = coordinate.axes[0];
        let y = coordinate.axes[1];
        let amplitude = (x.powi(2) + y.powi(2)).sqrt();
        let angle = self.quantize_angle(y.atan2(x).to_degrees() + degrees).degrees();
        let radians = angle.to_radians();

        let mut rotated_axes = coordinate.axes.clone();
        rotated_axes[0] = amplitude * radians.cos();
        rotated_axes[1] = amplitude * radians.sin();

        Coordinate::new(coordinate.id, rotated_axes)
    }

    fn project(&self, coordinate: &Coordinate, target: Dimensionality) -> Coordinate {
        project_coordinate(coordinate, target)
    }
}

fn product_sample(coordinate: &Coordinate) -> Scalar {
    match coordinate.axes.as_slice() {
        [x, y, ..] => x * y,
        [x] => *x,
        [] => 0.0,
    }
}

fn rotate_coordinate(coordinate: &Coordinate, degrees: Scalar) -> Coordinate {
    if coordinate.axes.len() < 2 {
        return coordinate.clone();
    }

    let radians = degrees.to_radians();
    let cos_theta = radians.cos();
    let sin_theta = radians.sin();
    let x = coordinate.axes[0];
    let y = coordinate.axes[1];

    let mut rotated_axes = coordinate.axes.clone();
    rotated_axes[0] = (x * cos_theta) - (y * sin_theta);
    rotated_axes[1] = (x * sin_theta) + (y * cos_theta);

    Coordinate::new(coordinate.id, rotated_axes)
}

fn project_coordinate(coordinate: &Coordinate, target: Dimensionality) -> Coordinate {
    let target_len = target.as_usize();
    let mut projected_axes = coordinate.axes.clone();

    projected_axes.truncate(target_len);
    while projected_axes.len() < target_len {
        projected_axes.push(0.0);
    }

    Coordinate::new(coordinate.id, projected_axes)
}

#[cfg(test)]
mod tests {
    use super::{
        Angle, FibonacciAccumulation, HelixManifold, Manifold, ProductManifold, Quadrant,
        FIBONACCI_COLLAPSE_THRESHOLD,
    };
    use crate::identity::{Coordinate, DimensionalPerspective, DimensionalStage, Dimensionality};

    #[test]
    fn samples_product_from_first_two_axes() {
        let manifold = ProductManifold::new();
        let coordinate = Coordinate::new(1, [3.0, 4.0, 5.0]);

        assert_eq!(manifold.sample(&coordinate), 12.0);
    }

    #[test]
    fn project_truncates_or_pads_axes() {
        let manifold = ProductManifold::new();
        let coordinate = Coordinate::new(2, [1.0, 2.0, 3.0]);

        assert_eq!(manifold.project(&coordinate, Dimensionality(2)).axes, vec![1.0, 2.0]);
        assert_eq!(manifold.project(&coordinate, Dimensionality(5)).axes, vec![1.0, 2.0, 3.0, 0.0, 0.0]);
    }

    #[test]
    fn rotates_first_two_axes() {
        let manifold = ProductManifold::new();
        let coordinate = Coordinate::new(3, [1.0, 0.0]);
        let rotated = manifold.rotate(&coordinate, 90.0);

        assert!(rotated.axes[0].abs() < 1e-10);
        assert!((rotated.axes[1] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn angle_normalizes_to_single_turn() {
        assert_eq!(Angle::new(450.0).degrees(), 90.0);
        assert_eq!(Angle::new(-90.0).degrees(), 270.0);
    }

    #[test]
    fn helix_quantizes_angles_to_primary_pivots() {
        let manifold = HelixManifold::new();

        assert_eq!(manifold.quantize_angle(44.0).degrees(), 0.0);
        assert_eq!(manifold.quantize_angle(46.0).degrees(), 90.0);
        assert_eq!(manifold.quantize_angle(226.0).degrees(), 270.0);
    }

    #[test]
    fn helix_classifies_quadrant_and_target_dimension() {
        let manifold = HelixManifold::new();
        let coordinate = Coordinate::new(4, [0.0, 2.0]);
        let projection = manifold.classify(&coordinate);

        assert_eq!(projection.quadrant, Quadrant::Ninety);
        assert_eq!(projection.stage, DimensionalStage::Line);
        assert_eq!(projection.target_dimensionality, Dimensionality(3));
        assert!((projection.amplitude - 2.0).abs() < 1e-10);
    }

    #[test]
    fn fibonacci_accumulation_tracks_stage_and_collapse_threshold() {
        let point = FibonacciAccumulation::at(0).unwrap();
        let volume = FibonacciAccumulation::at(3).unwrap();
        let mature_whole = FibonacciAccumulation::at(7).unwrap();

        assert_eq!(point.units, 1);
        assert_eq!(point.stage, DimensionalStage::Point);
        assert_eq!(volume.units, 3);
        assert_eq!(volume.stage, DimensionalStage::Volume);
        assert_eq!(mature_whole.units, FIBONACCI_COLLAPSE_THRESHOLD);
        assert_eq!(mature_whole.stage, DimensionalStage::Whole);
        assert!(mature_whole.collapse_ready);
    }

    #[test]
    fn helix_rotation_snaps_to_primary_pivot() {
        let manifold = HelixManifold::new();
        let coordinate = Coordinate::new(5, [1.0, 0.0]);
        let rotated = manifold.rotate(&coordinate, 46.0);

        assert!(rotated.axes[0].abs() < 1e-10);
        assert!((rotated.axes[1] - 1.0).abs() < 1e-10);
    }

    #[test]
    fn helix_inherits_dimension_from_quantized_angle() {
        let manifold = HelixManifold::new();
        let coordinate = Coordinate::new(6, [-1.0, 0.0]);
        let inherited = manifold.inherit_dimension(&coordinate);

        assert_eq!(inherited.axes.len(), 4);
        assert_eq!(inherited.axes[0], -1.0);
        assert_eq!(inherited.axes[1], 0.0);
        assert_eq!(inherited.axes[2], 0.0);
        assert_eq!(inherited.axes[3], 0.0);
    }

    #[test]
    fn helix_exposes_hardening_principles() {
        let principles = HelixManifold::new().hardening_principles();

        assert!(principles.minimal_material);
        assert!(principles.maximal_surface_area);
        assert!(principles.maximal_strength);
    }

    #[test]
    fn helix_promotes_mature_whole_into_point_of_next_dimension() {
        let manifold = HelixManifold::new();
        let coordinate = Coordinate::new(7, [1.0, 2.0, 3.0, 4.0, 5.0]);
        let promotion = manifold
            .collapse_whole_to_next_dimension(&coordinate, 7)
            .unwrap();

        assert_eq!(promotion.source_stage, DimensionalStage::Whole);
        assert_eq!(promotion.target_dimensionality, Dimensionality(6));
        assert_eq!(promotion.target_perspective, DimensionalPerspective::Point);
    }

    #[test]
    fn helix_does_not_promote_before_mature_threshold() {
        let manifold = HelixManifold::new();
        let coordinate = Coordinate::new(8, [1.0, 2.0, 3.0, 4.0, 5.0]);

        assert!(manifold
            .collapse_whole_to_next_dimension(&coordinate, 6)
            .is_none());
    }
}