import { Column as CSVColumn, NumberColumn } from '@lukaswagner/csv-parser';

export const serializeColumnInfo = (column?: CSVColumn): string => {
    if (!column) {
        return '';
    }
    return `${column.name}_${column.length}_${(column as NumberColumn).min}_${(column as NumberColumn).max}`;
};
