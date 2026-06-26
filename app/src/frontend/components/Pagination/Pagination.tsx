type PaginationProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  totalLabel?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

const pageSizes = [5, 10, 20, 50];

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  totalLabel = "条",
  onPageChange,
  onPageSizeChange
}: PaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const disabledPrev = safePage <= 1;
  const disabledNext = safePage >= safeTotalPages;

  function changePage(value: number) {
    onPageChange(Math.min(Math.max(1, value), safeTotalPages));
  }

  return (
    <div className="pagination-bar">
      <button type="button" disabled={disabledPrev} onClick={() => changePage(1)}>首页</button>
      <button type="button" disabled={disabledPrev} onClick={() => changePage(safePage - 1)}>上一页</button>
      <label className="pager-jump">第
        <input
          min={1}
          max={safeTotalPages}
          type="number"
          value={safePage}
          onChange={(event) => changePage(Number(event.target.value || 1))}
        />
        / {safeTotalPages} 页
      </label>
      <label className="pager-size">每页
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
          {pageSizes.map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
      </label>
      <button type="button" disabled={disabledNext} onClick={() => changePage(safePage + 1)}>下一页</button>
      <button type="button" disabled={disabledNext} onClick={() => changePage(safeTotalPages)}>末页</button>
      <span className="pager-total">共 {total} {totalLabel}</span>
    </div>
  );
}
