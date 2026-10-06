/// UI columns are 1-based Unicode characters; spans are byte offsets.
/// Serde's byte columns have an explicit conversion.
pub(crate) struct LineIndex<'a> {
    content: &'a str,
    offsets: Vec<usize>,
}
impl<'a> LineIndex<'a> {
    pub(crate) fn new(content: &'a str) -> Self {
        let mut offsets = vec![0];
        let bytes = content.as_bytes();
        for (i, byte) in bytes.iter().enumerate() {
            if *byte == b'\n' || (*byte == b'\r' && bytes.get(i + 1) != Some(&b'\n')) {
                offsets.push(i + 1);
            }
        }
        Self { content, offsets }
    }
    pub(crate) fn line_col(&self, offset: usize) -> (usize, usize) {
        let mut offset = offset.min(self.content.len());
        while !self.content.is_char_boundary(offset) {
            offset -= 1;
        }
        let line = self.offsets.partition_point(|start| *start <= offset) - 1;
        (
            line + 1,
            self.content[self.offsets[line]..offset].chars().count() + 1,
        )
    }
    pub(crate) fn offset(&self, line: usize, column: usize) -> usize {
        let start = *self
            .offsets
            .get(line.saturating_sub(1))
            .unwrap_or(&self.content.len());
        let text = self.content[start..]
            .split(['\n', '\r'])
            .next()
            .unwrap_or("");
        start
            + text
                .char_indices()
                .nth(column.saturating_sub(1))
                .map_or(text.len(), |(i, _)| i)
    }
    pub(crate) fn byte_offset(&self, line: usize, column: usize) -> usize {
        let start = *self
            .offsets
            .get(line.saturating_sub(1))
            .unwrap_or(&self.content.len());
        let mut offset = (start + column.saturating_sub(1)).min(self.content.len());
        while !self.content.is_char_boundary(offset) {
            offset -= 1;
        }
        offset
    }
}
