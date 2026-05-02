export type CsvCell = string | number | boolean | null | undefined;

export type CsvColumn<Row> = {
  header: string;
  get: (row: Row) => CsvCell;
};

export function toCsvRow(values: CsvCell[]): string {
  return values
    .map((v) => {
      const s = v == null ? "" : String(v);
      return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
    })
    .join(",");
}

export function toCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const headerLine = toCsvRow(columns.map((c) => c.header));
  const dataLines = rows.map((row) => toCsvRow(columns.map((c) => c.get(row))));
  return [headerLine, ...dataLines].join("\n");
}
