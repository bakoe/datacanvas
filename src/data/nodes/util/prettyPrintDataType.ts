import { DataType } from '@lukaswagner/csv-parser';

export const prettyPrintDataType = (dataType: DataType): string => {
    switch (dataType.valueOf()) {
        case 'string':
            return 'Strings';
        case 'number':
            return 'Numbers';
    }
    return 'Elements';
};
