export const ARRAY_DELIMITER = ",";
export const SLIDER_DELIMITER = "-";
export const SPACE_DELIMITER = "_";
// NOTE: intentionally the same character as SLIDER_DELIMITER. Sliders and
// timeranges both serialize as `min-max`, and the parser picks the branch from
// the column's filter type, not the delimiter. Keep these two in sync — changing
// one without the other silently breaks whichever filter kept the old value.
export const RANGE_DELIMITER = "-";
export const SORT_DELIMITER = ".";
