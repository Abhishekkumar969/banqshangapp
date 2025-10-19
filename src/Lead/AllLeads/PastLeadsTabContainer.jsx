import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import PastEnquiry from '../../Enquiry/pastEnquiry/pastEnquiry';
import DroppedLeads from './LeadsTabs/DroppedLeads';
import CancelledBookings from '../../Book/CancelledLeads/CancelledLeadsTable';
import '../../styles/LeadsTabContainer.css';
import BackButton from "../../components/BackButton";

const LeadsTabContainer = () => {

    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const tabFromURL = queryParams.get("tab");

    const [activeTab, setActiveTab] = useState('dropped');

    useEffect(() => {
        if (tabFromURL === "PastEnquiry") {
            setActiveTab("PastEnquiry");
        } else if (tabFromURL === "dropped") {
            setActiveTab("dropped");
        } else if (tabFromURL === "cancelled") {
            setActiveTab("cancelled");
        }
    }, [tabFromURL]);

    const renderActiveComponent = () => {
        switch (activeTab) {
            // pastLeads
            case 'PastEnquiry': return <PastEnquiry />;
            case 'dropped': return <DroppedLeads />;
            case 'cancelled': return <CancelledBookings />;
            default: return null;
        }
    };

    return (
        <div className="leads-tab-wrapper">
            <BackButton />
            <div>{renderActiveComponent()}</div>
            <div className="tab-buttons">

                <button
                    onClick={() => setActiveTab('PastEnquiry')}
                    className={activeTab === 'PastEnquiry' ? 'active' : ''}
                >
                    <span>Enquiry </span>
                </button>


                <button
                    onClick={() => setActiveTab('dropped')}
                    className={activeTab === 'dropped' ? 'active' : ''}
                >
                    <span>Leads </span>
                </button>


                <button
                    onClick={() => setActiveTab('cancelled')}
                    className={activeTab === 'cancelled' ? 'active' : ''}
                >
                    <span>Bookings</span>
                </button>

            </div>
        </div>

    );
};

export default LeadsTabContainer;
