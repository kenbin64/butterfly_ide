// butterfly_ide_lib/src/foundation/volume/manifolds/division_plane.rs

use crate::foundation::volume::core::primitives::Point;
use crate::foundation::volume::core::traits::Constraint;

/// Division Plane Manifold: z = x / y
///
/// This manifold is the inverse of the multiplicative plane (z = x * y).
/// It encodes:
/// - separation
/// - distinction
/// - ratio
/// - boundary formation
/// - inverse scaling
///
/// In the dimensional engine:
/// - multiplication unifies (x * y)
/// - division separates (x / y)
///
/// This is one of the fundamental "differentiation" manifolds.
pub struct DivisionPlane;

impl Constraint for DivisionPlane {
    fn contains(&self, p: &Point<3>) -> bool {
        let x = p.coords[0];
        let y = p.coords[1];
        let z = p.coords[2];

        // Avoid division by zero: points where y = 0 are undefined.
        if y.abs() < 1e-12 {
            return false;
        }

        // Manifold rule: z = x / y
        (z - (x / y)).abs() < 1e-9
    }
}