package tinybird

// PendingRows reports the rows buffered for a data source and not yet detached.
func (b *Batcher) PendingRows(dataSource string) int {
	b.mu.Lock()
	defer b.mu.Unlock()
	if pending, ok := b.batches[dataSource]; ok {
		return len(pending.waiters)
	}

	return 0
}
