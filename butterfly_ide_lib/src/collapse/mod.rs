pub trait Collapse<T> {
    fn collapse(&self) -> T;
}

#[cfg(test)]
mod tests {
    use super::Collapse;

    struct ValueCollapse<T>(T);

    impl<T: Clone> Collapse<T> for ValueCollapse<T> {
        fn collapse(&self) -> T {
            self.0.clone()
        }
    }

    #[test]
    fn collapse_returns_expected_value() {
        let collapse = ValueCollapse("butterfly");

        assert_eq!(collapse.collapse(), "butterfly");
    }
}
