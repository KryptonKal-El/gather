/**
 * Custom SVG icons for list types in Gather brand style.
 * Uses soft, rounded shapes with pastel fills from the brand palette.
 */

import PropTypes from 'prop-types';

/**
 * Grocery list icon - shopping bag with a leaf peeking out.
 */
export const GroceryIcon = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Bag body */}
    <path
      d="M8 14C8 12.8954 8.89543 12 10 12H30C31.1046 12 32 12.8954 32 14V32C32 34.2091 30.2091 36 28 36H12C9.79086 36 8 34.2091 8 32V14Z"
      fill="#B5E8C8"
    />
    {/* Bag handle */}
    <path
      d="M14 12V9C14 6.23858 16.2386 4 19 4H21C23.7614 4 26 6.23858 26 9V12"
      stroke="#3D7A63"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    {/* Carrot body */}
    <ellipse cx="20" cy="18" rx="3" ry="6" fill="#FFA07A" />
    {/* Carrot leaves */}
    <path
      d="M18 13C18 13 19 10 20 10C21 10 22 13 22 13"
      stroke="#3D7A63"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M17 14C17 14 18.5 11 20 11C21.5 11 23 14 23 14"
      stroke="#3D7A63"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    {/* White decorative lines on bag */}
    <path d="M12 26H18" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <path d="M12 30H22" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

GroceryIcon.propTypes = {
  size: PropTypes.number,
};

/**
 * To-do list icon - rounded checkbox with checkmark.
 */
export const TodoIcon = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Rounded square checkbox */}
    <rect x="6" y="6" width="28" height="28" rx="8" fill="#A8D8EA" />
    {/* Inner highlight */}
    <rect x="9" y="9" width="22" height="22" rx="6" fill="#B5E8C8" fillOpacity="0.4" />
    {/* Checkmark */}
    <path
      d="M13 20L18 25L27 14"
      stroke="#3D7A63"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

TodoIcon.propTypes = {
  size: PropTypes.number,
};

/**
 * Basic list icon - simple list lines inside a rounded card.
 */
export const BasicIcon = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Card background */}
    <rect x="6" y="4" width="28" height="32" rx="6" fill="#85BFA8" />
    {/* White list lines */}
    <path d="M12 12H28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M12 20H28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M12 28H22" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

BasicIcon.propTypes = {
  size: PropTypes.number,
};

/**
 * Packing list icon - suitcase/luggage.
 */
export const PackingIcon = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Suitcase body */}
    <rect x="6" y="12" width="28" height="22" rx="4" fill="#A8D8EA" />
    {/* Handle */}
    <path
      d="M14 12V9C14 7.34315 15.3431 6 17 6H23C24.6569 6 26 7.34315 26 9V12"
      stroke="#B5E8C8"
      strokeWidth="3"
      strokeLinecap="round"
    />
    {/* Horizontal strap */}
    <rect x="6" y="20" width="28" height="4" fill="#B5E8C8" />
    {/* Center buckle */}
    <rect x="17" y="18" width="6" height="8" rx="1" fill="white" />
    {/* Wheels */}
    <circle cx="12" cy="35" r="2" fill="#3D7A63" />
    <circle cx="28" cy="35" r="2" fill="#3D7A63" />
  </svg>
);

PackingIcon.propTypes = {
  size: PropTypes.number,
};

/**
 * Guest list icon - two friendly people silhouettes.
 */
export const GuestListIcon = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Back person (smaller, offset) */}
    <circle cx="26" cy="12" r="5" fill="#B5E8C8" />
    <path
      d="M18 36V30C18 26.6863 20.6863 24 24 24H28C31.3137 24 34 26.6863 34 30V36"
      fill="#B5E8C8"
    />
    {/* Front person (larger, foreground) */}
    <circle cx="15" cy="14" r="6" fill="#F9A8C9" />
    <path
      d="M4 36V29C4 25.134 7.13401 22 11 22H19C22.866 22 26 25.134 26 29V36"
      fill="#F9A8C9"
    />
    {/* Subtle face details on front person */}
    <circle cx="13" cy="13" r="1" fill="white" fillOpacity="0.6" />
    <circle cx="17" cy="13" r="1" fill="white" fillOpacity="0.6" />
  </svg>
);

GuestListIcon.propTypes = {
  size: PropTypes.number,
};

/**
 * Project list icon - clipboard with progress bar.
 */
export const ProjectIcon = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Clipboard body */}
    <rect x="6" y="6" width="28" height="30" rx="4" fill="#85BFA8" />
    {/* Clipboard clip */}
    <rect x="14" y="3" width="12" height="6" rx="2" fill="#3D7A63" />
    {/* Clip hole */}
    <rect x="17" y="4.5" width="6" height="3" rx="1.5" fill="#85BFA8" />
    {/* Progress bar background */}
    <rect x="10" y="16" width="20" height="5" rx="2.5" fill="white" fillOpacity="0.5" />
    {/* Progress bar fill */}
    <rect x="10" y="16" width="14" height="5" rx="2.5" fill="#B5E8C8" />
    {/* Task lines */}
    <path d="M10 26H26" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <path d="M10 31H20" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

ProjectIcon.propTypes = {
  size: PropTypes.number,
};
