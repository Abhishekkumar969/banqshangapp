import React, { useState } from 'react';
import BookingLeadsTable from './BookingLeadsTable';
import DroppedLeads from './LeadsTabs/DroppedLeads';
import EnquiryDetails from '../../Enquiry/EnquiryDetails';
import AllBookings from '../../Book/AllLeads/BookingLeadsTable';
import CancelledBookings from '../../Book/CancelledLeads/CancelledLeadsTable';
import '../../styles/LeadsTabContainer.css';
import BackButton from "../../components/BackButton";


const LeadsTabContainer = () => {
    const [activeTab, setActiveTab] = useState('booking');

    const renderActiveComponent = () => {
        switch (activeTab) {
            // pastLeads
            case 'EnquiryDetails': return <EnquiryDetails />;
            case 'booking': return <BookingLeadsTable />;
            case 'dropped': return <DroppedLeads />;
            case 'all': return <AllBookings />;
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
                    onClick={() => setActiveTab('EnquiryDetails')}
                    className={activeTab === 'EnquiryDetails' ? 'active' : ''}
                >
                    <span>Enquiry </span>
                </button>

                <button
                    onClick={() => setActiveTab('booking')}
                    className={activeTab === 'booking' ? 'active' : ''}
                >
                    <span>Leads </span>
                </button>


                {/* <button
                    onClick={() => setActiveTab('dropped')}
                    className={activeTab === 'dropped' ? 'active' : ''}
                >
                    <span>Dropped</span>
                </button> */}

                <button
                    onClick={() => setActiveTab('all')}
                    className={activeTab === 'all' ? 'active' : ''}
                >
                    <span>Bookings</span>
                </button>

                {/* <button
                    onClick={() => setActiveTab('cancelled')}
                    className={activeTab === 'cancelled' ? 'active' : ''}
                >
                    <span>Cancelled</span>
                </button> */}
                
            </div>
        </div>

    );
};

export default LeadsTabContainer;
