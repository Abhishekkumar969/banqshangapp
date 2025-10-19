import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import EnquiryDetails from '../../Enquiry/EnquiryDetails';
import BookingLeadsTable from './BookingLeadsTable';
import AllBookings from '../../Book/AllLeads/BookingLeadsTable';
import '../../styles/LeadsTabContainer.css';
import BackButton from "../../components/BackButton";

const LeadsTabContainer = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const tabFromURL = queryParams.get("tab");

    // Default to 'booking' (Leads tab) if no tab in URL
    const [activeTab, setActiveTab] = useState('booking');

    useEffect(() => {
        if (tabFromURL === "enquiry") {
            setActiveTab("EnquiryDetails");
        } else if (tabFromURL === "bookings") {
            setActiveTab("all");
        } else {
            // If URL is empty or ?tab=leads, default to 'booking'
            setActiveTab("booking");
        }
    }, [tabFromURL]);

    const renderActiveComponent = () => {
        switch (activeTab) {
            case 'EnquiryDetails': return <EnquiryDetails />;
            case 'booking': return <BookingLeadsTable />;
            case 'all': return <AllBookings />;
            default: return null;
        }
    };

    const handleTabClick = (tabKey, urlParam) => {
        setActiveTab(tabKey);
        window.history.replaceState(null, "", `?tab=${urlParam}`);
    };

    return (
        <div className="leads-tab-wrapper">
            <BackButton setActiveTab={setActiveTab} />

            <div>{renderActiveComponent()}</div>

            <div className="tab-buttons">
                <button
                    onClick={() => handleTabClick('EnquiryDetails', 'enquiry')}
                    className={activeTab === 'EnquiryDetails' ? 'active' : ''}
                >
                    <span>Enquiry</span>
                </button>

                <button
                    onClick={() => handleTabClick('booking', 'leads')}
                    className={activeTab === 'booking' ? 'active' : ''}
                >
                    <span>Leads</span>
                </button>

                <button
                    onClick={() => handleTabClick('all', 'bookings')}
                    className={activeTab === 'all' ? 'active' : ''}
                >
                    <span>Bookings</span>
                </button>
            </div>
        </div>
    );
};

export default LeadsTabContainer;
