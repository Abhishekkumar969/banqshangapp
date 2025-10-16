import React from 'react';
import { useNavigate } from 'react-router-dom';

// Utility function to define the full navigation configuration based on userAppType
const getNavConfig = (userAppType) => {
    // Default config for Admin/Staff (A, D, B, F, G)
    let navItems = [
        { label: 'Home', icon: '🏠', path: '/' },
        { label: 'Records', icon: '🗂️', path: '/leadstabcontainer' },
        { label: 'Receipts', icon: '🧾', path: '/MoneyReceipts' },
        { label: 'Profile', icon: '🧑‍💼', path: '/AdminProfile' },
    ];
    let centralAction = {
        label: 'Booking',
        icon: '💒',
        path: '/Booking',
        isCentral: true
    };

    switch (userAppType) {
        case 'C': // Vendor App
            navItems = [
                { label: 'Home', icon: '🏠', path: '/' },
                { label: 'UpComings', icon: '🗓️', path: '/VendorTable' },
                { label: 'Booked', icon: '✅', path: '/VendorBookedTable' },
                { label: 'Profile', icon: '🧑‍💼', path: '/VendorProfile' },
            ];
            centralAction = {
                label: 'Form',
                icon: '📝',
                path: '/VendorOtherForm',
                isCentral: true
            };
            break;

        case 'E': // Decoration App
            navItems = [
                { label: 'Home', icon: '🏠', path: '/' },
                { label: 'UpComings', icon: '🗓️', path: '/DecorationTable' },
                { label: 'Booked', icon: '✅', path: '/DecorationBookedTable' },
                { label: 'Profile', icon: '🧑‍💼', path: '/DecorationProfile' },
            ];
            centralAction = {
                label: 'Form',
                icon: '📝',
                path: '/DecorationOtherForm',
                isCentral: true
            };
            break;

        // For other types (A, D, B, F, G) or null, use the Admin/Staff default
        default:
            // The default is already set above
            break;
    }

    return { navItems, centralAction };
};


const BottomNavigationBar = ({ userAppType }) => {
    const navigate = useNavigate();

    // Get the dynamic configuration
    const { navItems, centralAction } = getNavConfig(userAppType);

    // Determine if the current path is active for styling
    const isActive = (path) => {
        // Use window.location.pathname, but normalize trailing slashes for comparison
        const currentPath = window.location.pathname.replace(/\/$/, '');
        const normalizedPath = path.replace(/\/$/, '');
        return currentPath === normalizedPath;
    };

    const handleNavigation = (path) => {
        navigate(path);
    };

    return (
        <div className="bottom-nav-bar">
            {/* First two items */}
            {navItems.slice(0, 2).map(item => (
                <div
                    key={item.label}
                    className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                    onClick={() => handleNavigation(item.path)}
                >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                </div>
            ))}

            {/* Central Action Button */}
            <div
                className={`nav-item central-action ${isActive(centralAction.path) ? 'central-active' : ''}`}
                onClick={() => handleNavigation(centralAction.path)}
            >
                <div className="central-icon-bg">
                    <span className="central-icon">{centralAction.icon}</span>
                </div>
            </div>

            {/* Last two items */}
            {navItems.slice(2).map(item => (
                <div
                    key={item.label}
                    className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                    onClick={() => handleNavigation(item.path)}
                >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                </div>
            ))}
        </div>
    );
};

export default BottomNavigationBar;
