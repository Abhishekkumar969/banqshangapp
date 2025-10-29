import React from 'react';
import { useNavigate } from 'react-router-dom';

const getNavConfig = (userAppType) => {

    let navItems = [
        { icon: '', path: '/' },
        { icon: '🏠', path: '/' },
        { icon: '🗂️', path: '/leadstabcontainer' },
        { icon: '', path: '/' },
    ];

    let centralAction = {
        icon: '📨',
        path: '/EnquiryForm',
        isCentral: true
    };

    switch (userAppType) {

        case 'A':
            navItems = [
                { icon: '🏠', path: '/' },
                { icon: '🧾', path: '/MoneyReceipts' },
                { icon: '🗂️', path: '/leadstabcontainer' },
                { icon: '🧑‍💼', path: '/AdminProfile' },
            ];
            centralAction = {
                icon: '📨',
                path: '/EnquiryForm',
                isCentral: true
            };
            break;

        case 'C':
            navItems = [
                { icon: '🏠', path: '/' },
                { icon: '🗓️', path: '/VendorTable' },
                { icon: '✅', path: '/VendorBookedTable' },
                { icon: '🧑‍💼', path: '/VendorProfile' },
            ];
            centralAction = {
                icon: '📝',
                path: '/VendorOtherForm',
                isCentral: true
            };
            break;

        case 'E':
            navItems = [
                { icon: '🏠', path: '/' },
                { icon: '🗓️', path: '/DecorationTable' },
                { icon: '✅', path: '/DecorationBookedTable' },
                { icon: '🧑‍💼', path: '/DecorationProfile' },
            ];
            centralAction = {
                // label: 'Form',
                icon: '📝',
                path: '/DecorationOtherForm',
                isCentral: true
            };
            break;

        default:
            break;
    }

    return { navItems, centralAction };
};

const BottomNavigationBar = ({ userAppType }) => {
    const navigate = useNavigate();

    const { navItems, centralAction } = getNavConfig(userAppType);

    const isActive = (path) => {
        const currentPath = window.location.pathname.replace(/\/$/, '');
        const normalizedPath = path.replace(/\/$/, '');
        return currentPath === normalizedPath;
    };

    const handleNavigation = (path) => {
        navigate(path);
    };

    return (
        <div className="bottom-nav-bar">
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

            <div
                className={`nav-item central-action ${isActive(centralAction.path) ? 'central-active' : ''}`}
                onClick={() => handleNavigation(centralAction.path)}
            >
                <div className="central-icon-bg">
                    <span className="central-icon">{centralAction.icon}</span>
                </div>
            </div>

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
