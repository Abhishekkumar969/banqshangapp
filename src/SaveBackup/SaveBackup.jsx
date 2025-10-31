import React, { useEffect, useState } from "react";
import BackButton from "../components/BackButton";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebaseConfig";
import styles from "./SaveBackup.module.css";

const collectionNames = [
    "enquiry", "bookingLeads", "prebookings", "pastEnquiry", "dropLeads",
    "cancelledBookings", "moneyReceipts", "accountant", "events", "expenses",
    "vendor", "catering", "decoration", "ledger", "settings",
    "otherMoneyReceipts", "menu", "usersAccess", "pannelAccess", "accessRequests"
];

const SaveBackup = () => {
    const [collectionsData, setCollectionsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedDocs, setSelectedDocs] = useState({});

    useEffect(() => {
        const fetchCollectionsAndDocs = async () => {
            try {
                setLoading(true);
                const allData = [];

                for (const name of collectionNames) {
                    const docsSnap = await getDocs(collection(db, name));

                    const monthOrder = [
                        "jan", "feb", "mar", "apr", "may", "jun",
                        "jul", "aug", "sep", "oct", "nov", "dec"
                    ];

                    const docs = docsSnap.docs
                        .map((d) => d.id)
                        .sort((a, b) => {
                            const extractMonthYear = (id) => {
                                const monthMatch = id.match(/[a-zA-Z]{3,}/);
                                const yearMatch = id.match(/\d{4}/);
                                const month = monthMatch
                                    ? monthOrder.indexOf(monthMatch[0].toLowerCase())
                                    : -1;
                                const year = yearMatch ? parseInt(yearMatch[0]) : 0;
                                return { month, year };
                            };

                            const A = extractMonthYear(a);
                            const B = extractMonthYear(b);

                            if (A.year === B.year) return A.month - B.month;
                            return A.year - B.year;
                        });

                    if (docs.length > 0) {
                        allData.push({ name, documents: docs });
                    }
                }

                setCollectionsData(allData);
            } catch (err) {
                console.error("Error fetching Firestore data:", err);
                setError("Failed to fetch data. Check console for details.");
            } finally {
                setLoading(false);
            }
        };

        fetchCollectionsAndDocs();
    }, []);

    const toggleDocSelection = (colName, docId) => {
        setSelectedDocs((prev) => ({
            ...prev,
            [colName]: prev[colName]?.includes(docId)
                ? prev[colName].filter((id) => id !== docId)
                : [...(prev[colName] || []), docId],
        }));
    };

    const toggleSelectAll = (colName, docs) => {
        setSelectedDocs((prev) => {
            const isAllSelected = prev[colName]?.length === docs.length;
            return {
                ...prev,
                [colName]: isAllSelected ? [] : docs,
            };
        });
    };

    // ✅ Global Select/Unselect All button
    const toggleSelectAllGlobal = () => {
        const allSelected = collectionsData.every(
            (col) => selectedDocs[col.name]?.length === col.documents.length
        );

        if (allSelected) {
            // Unselect all
            setSelectedDocs({});
        } else {
            // Select all
            const newSelections = {};
            collectionsData.forEach((col) => {
                newSelections[col.name] = [...col.documents];
            });
            setSelectedDocs(newSelections);
        }
    };

    const allSelected = collectionsData.length > 0 && collectionsData.every(
        (col) => selectedDocs[col.name]?.length === col.documents.length
    );

    return (
        <div className={styles["save-backup-page"]}>
            <div style={{ marginBottom: "55px" }}>
                <BackButton />
            </div>

            <h2 style={{ textAlign: "center", marginBottom: "20px", marginTop: "60px" }}>
                Save & Backup Data
            </h2>

            {/* ✅ Global Select/Unselect All Button */}
            {!loading && !error && collectionsData.length > 0 && (
                <div style={{ textAlign: "right", marginBottom: "0px" }}>
                    <button
                        className={styles["select-all-btn"]}
                        onClick={toggleSelectAllGlobal}
                    >
                        {allSelected ? "Unselect All Collections" : "Select All Collections"}
                    </button>
                </div>
            )}

            {loading && <p style={{ textAlign: "center" }}>Loading collections...</p>}
            {error && <p style={{ color: "red", textAlign: "center" }}>{error}</p>}

            {!loading && !error && (
                <div className={styles["backup-container"]}>
                    {collectionsData.length === 0 ? (
                        <p>No collections found in Firestore.</p>
                    ) : (
                        collectionsData.map((col) => (
                            <div key={col.name} className={styles["collection-box"]}>
                                <div className={styles["collection-header"]}>
                                    <h3>{col.name}</h3>
                                    <button
                                        className={styles["select-all-btn"]}
                                        onClick={() => toggleSelectAll(col.name, col.documents)}
                                    >
                                        {selectedDocs[col.name]?.length === col.documents.length
                                            ? "Unselect All"
                                            : "Select All"}
                                    </button>
                                </div>

                                <ul>
                                    {col.documents.map((docId, index) => (
                                        <li
                                            key={docId}
                                            className={`${styles["doc-item"]} ${selectedDocs[col.name]?.includes(docId)
                                                ? styles["selected"]
                                                : ""
                                                }`}
                                            onClick={() => toggleDocSelection(col.name, docId)}
                                        >
                                            <span>{docId}</span>
                                            <span className={styles["doc-number"]}>
                                                {index + 1}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default SaveBackup;
