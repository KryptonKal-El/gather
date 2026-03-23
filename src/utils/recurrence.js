/**
 * Recurrence rule engine for recurring items.
 * Computes the next due date from a recurrence rule.
 */

/** Valid recurrence types */
const VALID_TYPES = ['daily', 'weekly', 'biweekly', 'monthly', 'yearly', 'custom'];

/** Valid custom frequencies */
const VALID_FREQUENCIES = ['day', 'week', 'month', 'year'];

/**
 * Adds months to a date, handling month-end edge cases.
 * @param {Date} date - The starting date
 * @param {number} months - Number of months to add
 * @returns {Date} The resulting date
 */
const addMonths = (date, months) => {
  const result = new Date(date);
  const day = result.getDate();
  result.setMonth(result.getMonth() + months);
  // If day overflowed (e.g., Jan 31 + 1 month = Mar 3), set to last day of target month
  if (result.getDate() !== day) {
    result.setDate(0);
  }
  return result;
};

/**
 * Adds years to a date, handling leap year edge cases.
 * @param {Date} date - The starting date
 * @param {number} years - Number of years to add
 * @returns {Date} The resulting date
 */
const addYears = (date, years) => {
  const result = new Date(date);
  const day = result.getDate();
  result.setFullYear(result.getFullYear() + years);
  // Handle Feb 29 → Feb 28 in non-leap years
  if (result.getDate() !== day) {
    result.setDate(0);
  }
  return result;
};

/**
 * Adds days to a date.
 * @param {Date} date - The starting date
 * @param {number} days - Number of days to add
 * @returns {Date} The resulting date
 */
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Normalizes a date to noon UTC to avoid timezone issues.
 * @param {Date} date - The date to normalize
 * @returns {Date} The normalized date
 */
const normalizeToNoonUTC = (date) => {
  const result = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12, 0, 0, 0
  ));
  return result;
};

/**
 * Normalizes input to a Date object.
 * @param {Date|string} input - Date object or ISO string
 * @returns {Date|null} The normalized Date, or null if invalid
 */
const normalizeDate = (input) => {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'string') {
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
};

/**
 * Gets the next occurrence for custom weekly rules with daysOfWeek.
 * @param {Date} fromDate - The starting date
 * @param {number} interval - Week interval (e.g., 2 for every 2 weeks)
 * @param {number[]} daysOfWeek - Array of valid weekdays (0=Sun..6=Sat)
 * @returns {Date} The next matching date
 */
const getNextCustomWeeklyOccurrence = (fromDate, interval, daysOfWeek) => {
  const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
  const currentDayOfWeek = fromDate.getDay();
  
  // Find the next valid day starting from tomorrow
  let candidate = addDays(fromDate, 1);
  
  // Calculate the "week number" of the fromDate for interval tracking
  // We define week 0 as the week containing fromDate
  const startOfWeek = new Date(fromDate);
  startOfWeek.setDate(startOfWeek.getDate() - currentDayOfWeek);
  
  // Search up to interval * 7 + 7 days to find the next match
  const maxDays = interval * 7 + 7;
  
  for (let i = 0; i < maxDays; i++) {
    const candidateDayOfWeek = candidate.getDay();
    
    // Calculate how many weeks from fromDate's week start
    const daysDiff = Math.floor((candidate.getTime() - startOfWeek.getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysDiff / 7);
    
    // Check if this week is valid based on interval (week 0 and every Nth week after)
    const isValidWeek = weekNumber % interval === 0;
    
    if (isValidWeek && sortedDays.includes(candidateDayOfWeek)) {
      return candidate;
    }
    
    candidate = addDays(candidate, 1);
  }
  
  // Fallback (should not reach here with valid input)
  return addDays(fromDate, interval * 7);
};

/**
 * Computes the next due date from a recurrence rule.
 * @param {Object|null} rule - The recurrence rule object
 * @param {Date|string} fromDate - The starting date to compute from
 * @returns {Date|null} The next occurrence date, or null if rule is invalid
 */
export const getNextOccurrence = (rule, fromDate) => {
  // Validate rule
  if (!rule || typeof rule !== 'object') {
    return null;
  }
  
  const { type, interval, frequency, daysOfWeek } = rule;
  
  if (!type || !VALID_TYPES.includes(type)) {
    return null;
  }
  
  // Normalize fromDate
  const date = normalizeDate(fromDate);
  if (!date) {
    return null;
  }
  
  let result;
  
  switch (type) {
    case 'daily':
      result = addDays(date, 1);
      break;
      
    case 'weekly':
      result = addDays(date, 7);
      break;
      
    case 'biweekly':
      result = addDays(date, 14);
      break;
      
    case 'monthly':
      result = addMonths(date, 1);
      break;
      
    case 'yearly':
      result = addYears(date, 1);
      break;
      
    case 'custom':
      result = getCustomOccurrence(date, interval, frequency, daysOfWeek);
      if (!result) {
        return null;
      }
      break;
      
    default:
      return null;
  }
  
  return normalizeToNoonUTC(result);
};

/**
 * Computes the next occurrence for custom recurrence rules.
 * @param {Date} date - The starting date
 * @param {number|null} interval - The interval (every N)
 * @param {string|null} frequency - The frequency unit (day, week, month, year)
 * @param {number[]|null} daysOfWeek - Valid weekdays for weekly frequency
 * @returns {Date|null} The next occurrence, or null if invalid
 */
const getCustomOccurrence = (date, interval, frequency, daysOfWeek) => {
  // Custom requires both interval and frequency
  if (!interval || typeof interval !== 'number' || interval < 1) {
    return null;
  }
  
  if (!frequency || !VALID_FREQUENCIES.includes(frequency)) {
    return null;
  }
  
  switch (frequency) {
    case 'day':
      return addDays(date, interval);
      
    case 'week':
      // If daysOfWeek is specified, use the special weekly logic
      if (Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
        const validDays = daysOfWeek.filter(d => typeof d === 'number' && d >= 0 && d <= 6);
        if (validDays.length > 0) {
          return getNextCustomWeeklyOccurrence(date, interval, validDays);
        }
      }
      // Otherwise just add N weeks
      return addDays(date, interval * 7);
      
    case 'month':
      return addMonths(date, interval);
      
    case 'year':
      return addYears(date, interval);
      
    default:
      return null;
  }
};
