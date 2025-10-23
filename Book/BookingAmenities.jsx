import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import '../styles/BookingAmenities.css';

const BookingAmenities = ({ selectedItems, setSelectedItems }) => {
    const [defaultAmenities, setDefaultAmenities] = useState([]);
    const [toAddAmenities, setToAddAmenities] = useState([]);
    const [customAmenities, setCustomAmenities] = useState([]);
    const [customItem, setCustomItem] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [amenities, setAmenities] = useState([]);

    // Fetch amenities from Firestore
    const fetchAmenities = useCallback(async () => {
        try {
            const q = query(collection(db, "usersAccess"), where("accessToApp", "==", "A"));
            const snap = await getDocs(q);

            if (!snap.empty) {
                const allDefault = [];
                const allToAdd = [];

                snap.forEach(doc => {
                    const data = doc.data();
                    if (data.amenities && Array.isArray(data.amenities)) allDefault.push(...data.amenities);
                    if (data.toAddAmenities && Array.isArray(data.toAddAmenities)) allToAdd.push(...data.toAddAmenities);
                });

                const uniqueDefault = [...new Set(allDefault)];
                const uniqueToAdd = [...new Set(allToAdd)];

                setDefaultAmenities(uniqueDefault);
                setToAddAmenities(uniqueToAdd);

                // Preselect only default amenities
                if (selectedItems.length === 0) setSelectedItems(uniqueDefault);

            } else {
                console.warn("No usersAccess doc found with accessToApp: 'A'");
            }
        } catch (err) {
            console.error("Error fetching amenities:", err);
        }
    }, [selectedItems.length, setSelectedItems]);

    useEffect(() => {
        fetchAmenities();
    }, [fetchAmenities]);

    // Merge all amenities for display
    useEffect(() => {
        const merged = [...new Set([...defaultAmenities, ...toAddAmenities, ...customAmenities])];
        setAmenities(merged);
    }, [defaultAmenities, toAddAmenities, customAmenities]);

    // Load previous suggestions
    useEffect(() => {
        const storedSuggestions = JSON.parse(localStorage.getItem("customAmenitySuggestions") || "[]");
        setSuggestions(storedSuggestions);
    }, []);

    const handleCheckboxChange = (item) => {
        setSelectedItems(prev =>
            prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
        );
    };

    const handleAddCustomItem = () => {
        const trimmed = customItem.trim();
        if (!trimmed) return;
        if (!amenities.includes(trimmed)) {
            setCustomAmenities(prev => [...prev, trimmed]);
            setSelectedItems(prev => [...prev, trimmed]);

            // Save suggestion to localStorage
            const updatedSuggestions = [...new Set([...suggestions, trimmed])];
            setSuggestions(updatedSuggestions);
            localStorage.setItem("customAmenitySuggestions", JSON.stringify(updatedSuggestions));
        }
        setCustomItem('');
    };

    const filteredSuggestions = suggestions.filter(
        sug => sug.toLowerCase().includes(customItem.toLowerCase()) && sug.toLowerCase() !== customItem.toLowerCase()
    );

    const handleSuggestionClick = (sug) => {
        setCustomItem(sug);
    };

    return (
        <div className="booking-amenities">
            <h4 style={{ marginTop: '40px' }}>Complimentary Booking Amenities</h4>

            <ul className="amenities-list">
                {amenities.map((item, index) => (
                    <li key={index}>
                        <input
                            type="checkbox"
                            className="amenity-checkbox"
                            checked={selectedItems.includes(item)}
                            onChange={() => handleCheckboxChange(item)}
                        />
                        {item}
                    </li>
                ))}
            </ul>

            <div className="custom-amenity-form">
                <input
                    type="text"
                    value={customItem}
                    onChange={(e) => setCustomItem(e.target.value)}
                    placeholder="Add custom amenity..."
                />
                <button type="button" onClick={handleAddCustomItem}>Add</button>

                {customItem && filteredSuggestions.length > 0 && (
                    <ul className="suggestion-box">
                        {filteredSuggestions.map((sug, idx) => (
                            <li key={idx} onClick={() => handleSuggestionClick(sug)}>{sug}</li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default BookingAmenities;
