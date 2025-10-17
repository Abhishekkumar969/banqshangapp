import React, { useState, useEffect, useRef } from 'react';
import '../styles/Booking.css';
import LeadForm from './LeadForm';
import BookingAmenities from './BookingAmenities';
import LeadSummary from './LeadSummary';
import FoodMenuSelection from './FoodMenuSelection';
import CustomChargeItems from './CustomChargeItems';
import CustomMenuCharges from './CustomMenuCharges';
import MealSelection from './MealSelection';
import { db } from '../firebaseConfig';
import { collection, Timestamp, doc, setDoc, updateDoc, deleteField, getDoc } from 'firebase/firestore';
import BackButton from '../components/BackButton';
import { useLocation, useNavigate } from 'react-router-dom';
import { query, where, getDocs } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import BottomNavigationBar from "../components/BottomNavigationBar";

const BookingLead = () => {
    const [form, setForm] = useState({
        prefix: 'Mr.',
        name: '',
        email: '',
        enquiryDate: '',
        functionType: 'Wedding',
        functionDate: '',
        source: '',
        venueType: '',
        noOfPlates: '',
        extraPlates: '',
        hallCharges: '',
        startTime: '',
        referredBy: '',
        finishTime: '',
        mobile1: '',
        mobile2: '',
        dayNight: 'Night',
    });
    const [selectedMenus, setSelectedMenus] = useState({});
    const [selectedItems, setSelectedItems] = useState([]);
    const [advancePayments, setAdvancePayments] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [gstAmount, setGstAmount] = useState(0);
    const [grandTotal, setGrandTotal] = useState(0);
    const [gstBase, setGstBase] = useState('');
    const [discount, setDiscount] = useState('');
    const [commission, setCommission] = useState('');
    const [customItems, setCustomItems] = useState([]);
    const [customMenuCharges, setCustomMenuCharges] = useState([]);
    const [meals, setMeals] = useState({});
    const [lead, setLead] = useState(null);
    const [editingMode, setEditingMode] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [editorInfo, setEditorInfo] = useState({ name: "", email: "" });

    const leadFormRef = useRef();
    const customItemsRef = useRef();
    const customMenuRef = useRef();
    const summaryRef = useRef();
    const mealRef = useRef();

    const navigate = useNavigate();
    const location = useLocation();
    const auth = getAuth();
    const currentUser = auth.currentUser;

    const [userAppType, setUserAppType] = useState(null);
    useEffect(() => {
        const fetchUserAppType = async () => {
            const auth = getAuth();
            const user = auth.currentUser;
            if (user) {
                try {
                    const userRef = doc(db, 'usersAccess', user.email);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        const data = userSnap.data();
                        setUserAppType(data.accessToApp);
                    }
                } catch (err) {
                    console.error("Error fetching user app type:", err);
                }
            }
        };
        fetchUserAppType();
    }, []);

    // Toast handler
    const triggerToast = () => {
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
    };

    // Convert date to MonthYear format (e.g., Sep2025)
    const getMonthYear = (dateStr) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return `${monthNames[date.getMonth()]}${date.getFullYear()}`;
    };

    // Load editor info
    useEffect(() => {
        const loadEditor = async () => {
            if (currentUser?.email) {
                const q = query(collection(db, "usersAccess"), where("email", "==", currentUser.email));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    const docData = snapshot.docs[0].data();
                    setEditorInfo({ name: docData.name || "Unknown", email: docData.email });
                }
            }
        };
        loadEditor();
    }, [currentUser]);

    // Handle form changes
    const handleChange = (e, index = null) => {
        if (e.target.name === 'followUpDates') {
            const updated = [...form.followUpDates];
            updated[index] = e.target.value;
            setForm({ ...form, followUpDates: updated });
        } else {
            setForm({ ...form, [e.target.name]: e.target.value });
        }
    };

    // Submit handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSaving) return;

        const isValid = leadFormRef.current?.validateForm?.() &&
            customItemsRef.current?.validateCustomItems?.() &&
            summaryRef.current?.validateSummary?.() &&
            customMenuRef.current?.validateMenuCharges?.();

        if (!isValid) {
            triggerToast();
            return;
        }

        setIsSaving(true);

        try {
            const cleanedMenus = Object.fromEntries(
                Object.entries(selectedMenus || {}).filter(([_, v]) => ((v.noOfPlates || 0) + (v.extraPlates || 0)) > 0 && Number(v.total) > 0)
            );

            const bookingId = editingMode ? lead.id : doc(collection(db, "prebookings")).id;
            const monthYear = getMonthYear(form.enquiryDate);
            const monthRef = doc(db, "prebookings", monthYear);

            // Delete old month entry if month changed
            if (editingMode && lead?.sourceDoc && lead.sourceDoc !== monthYear) {
                const oldMonthRef = doc(db, "prebookings", lead.sourceDoc);
                await updateDoc(oldMonthRef, { [bookingId]: deleteField() });
            }

            const dataToSave = {
                ...form,
                id: bookingId,
                sourceDoc: monthYear,
                eventBookedBy: form.eventBookedBy || editorInfo.name || "Unknown",
                gstBase: parseFloat(gstBase || 0),
                gstAmount,
                totalAmount,
                grandTotal,
                discount: discount || 0,
                commission: commission || 0,
                bookingAmenities: selectedItems,
                advancePayments,
                customItems,
                customMenuCharges,
                meals,
                startTime: form.startTime || '',
                finishTime: form.finishTime || '',
                updatedAt: Timestamp.now(),
            };

            // Save to Firestore
            const monthSnap = await getDoc(monthRef);
            if (!monthSnap.exists()) {
                await setDoc(monthRef, { [bookingId]: { ...dataToSave, selectedMenus: cleanedMenus } });
            } else {
                const payload = {};
                Object.entries(dataToSave).forEach(([k, v]) => {
                    payload[`${bookingId}.${k}`] = v;
                });
                payload[`${bookingId}.selectedMenus`] = Object.keys(cleanedMenus).length ? cleanedMenus : deleteField();
                await updateDoc(monthRef, payload);
            }

            // Remove from bookingLeads if needed
            if (lead?.sourceDoc && location.state?.from === "bookingLeads") {
                const leadMonthRef = doc(db, "bookingLeads", lead.sourceDoc);
                await updateDoc(leadMonthRef, { [lead.id]: deleteField() });
            }

            // Remove enquiry if coming from enquiry flow
            if (location.state?.enquiry) {
                const { id, monthYear: enquiryMonth } = location.state.enquiry;
                const enquiryDocRef = doc(db, "enquiry", enquiryMonth);
                await setDoc(enquiryDocRef, { [id]: deleteField() }, { merge: true });
            }

            // Reset state
            setForm({
                prefix: 'Mr.', name: '', email: '', enquiryDate: '', functionType: 'Wedding',
                functionDate: '', source: '', venueType: '', noOfPlates: '', extraPlates: '',
                hallCharges: '', startTime: '', referredBy: '', finishTime: '', mobile1: '',
                mobile2: '', dayNight: 'Night',
            });
            setSelectedMenus({});
            setSelectedItems([]);
            setAdvancePayments([]);
            setGstBase('');
            setCommission('');
            setTotalAmount(0);
            setGstAmount(0);
            setGrandTotal(0);
            setCustomItems([]);
            setCustomMenuCharges([]);
            setMeals({});
            setDiscount('');
            setLead(null);
            setEditingMode(false);

            navigate(-1);

        } catch (error) {
            console.error("Error saving booking:", error);
            alert("❌ Error saving booking: " + error.message);
        } finally {
            setIsSaving(false);
        }
    };

    // Load lead for editing
    useEffect(() => {
        if (location.state?.leadToEdit) {
            const incoming = location.state.leadToEdit;
            const sourceDoc = location.state.sourceDoc || getMonthYear(incoming.enquiryDate);

            setLead({ ...incoming, sourceDoc });
            setForm({
                prefix: incoming.prefix || '',
                name: incoming.name || '',
                email: incoming.email || '',
                enquiryDate: incoming.enquiryDate || '',
                functionType: incoming.functionType || '',
                functionDate: incoming.functionDate || '',
                source: incoming.source || '',
                referredBy: incoming.referredBy || '',
                venueType: incoming.venueType || '',
                noOfPlates: incoming.noOfPlates || '',
                hallCharges: incoming.hallCharges || '',
                extraPlates: incoming.extraPlates || '',
                mobile1: incoming.mobile1 || '',
                note: incoming.note || '',
                mobile2: incoming.mobile2 || '',
                startTime: incoming.startTime || '11:00',
                finishTime: incoming.finishTime || '09:00',
                eventBookedBy: incoming.eventBookedBy || '',
                followUpDates: incoming.followUpDates || ['', '', '', '', ''],
                dayNight: incoming.dayNight || 'Night',
            });

            setSelectedMenus(incoming.selectedMenus || {});
            setSelectedItems(incoming.bookingAmenities || []);
            setAdvancePayments(incoming.advancePayments || []);
            setGstBase(incoming.gstBase || '');
            setCommission(incoming.commission || 0);
            setTotalAmount(incoming.totalAmount || 0);
            setGstAmount(incoming.gstAmount || 0);
            setGrandTotal(incoming.grandTotal || 0);
            setCustomItems(incoming.customItems || []);
            setCustomMenuCharges(incoming.customMenuCharges || []);
            setMeals(incoming.meals || {});
            setDiscount(incoming.discount || 0);
            setEditingMode(true);
        }
    }, [location.state]);

    return (
        <>
            <div className="booking-lead-container">
                <BackButton />

                <h2>EVENT BOOKING ESTIMATE</h2>
                <form className="form-section" onSubmit={handleSubmit}>
                    <LeadForm currentUserEmail={currentUser?.email} ref={leadFormRef} form={form} handleChange={handleChange} setForm={setForm} />
                    <BookingAmenities selectedItems={selectedItems} setSelectedItems={setSelectedItems} />
                    <CustomChargeItems
                        ref={customItemsRef}
                        customItems={customItems}
                        setCustomItems={setCustomItems}
                    />

                    <CustomMenuCharges
                        ref={customMenuRef}
                        menuCharges={customMenuCharges}
                        setMenuCharges={setCustomMenuCharges}
                    />

                    <FoodMenuSelection
                        selectedMenus={selectedMenus}
                        setSelectedMenus={setSelectedMenus}
                        noOfPlates={form.noOfPlates}
                        extraPlates={form.extraPlates}
                        editingMode={editingMode}
                    />

                    <MealSelection
                        ref={mealRef}
                        meals={meals}
                        setMeals={setMeals}
                        functionDate={form.functionDate}
                        dayNight={form.dayNight || "Night"}
                    />

                    <LeadSummary
                        ref={summaryRef}
                        leadId={lead?.id}
                        selectedMenus={selectedMenus}
                        hallCharges={form.hallCharges}

                        gstBase={gstBase}
                        setGstBase={setGstBase}

                        totalAmount={totalAmount}

                        discount={discount}
                        setDiscount={setDiscount}

                        commission={commission}
                        setCommission={setCommission}

                        setTotalAmount={setTotalAmount}

                        gstAmount={gstAmount}
                        setGstAmount={setGstAmount}

                        grandTotal={grandTotal}
                        setGrandTotal={setGrandTotal}

                        customItems={customItems}
                        customMenuCharges={customMenuCharges}
                        meals={meals}
                    />
                    <button type="submit" className="save-button" disabled={isSaving}>
                        {lead?.id ? (isSaving ? "Updating..." : "Update") : (isSaving ? "Saving..." : "Save")}
                    </button>
                </form>

                {/* ✅ Toast Notification */}
                {showToast && (
                    <div className="custom-toast">
                        Please fill all required fields.
                        <div className="toast-progress"></div>
                    </div>
                )}
            </div>
            <BottomNavigationBar navigate={navigate} userAppType={userAppType} />
        </>
    );
};

export default BookingLead;
