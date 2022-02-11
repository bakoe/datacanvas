import { Column as CSVColumn } from '@lukaswagner/csv-parser';

export const serializeColumnInfo = (column?: CSVColumn): string => {
    if (!column) {
        return '';
    }
    return `${column.name}_${column.length}`;
};
