import React, { useEffect, useState } from 'react';
import { collection, getDocs, deleteDoc, doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import '../styles/UserAccessTable.css';
import BackButton from "../components/BackButton";
import Modal from 'react-modal';

Modal.setAppElement('#root');

const UserAccessPanel = () => {
    const [approvedUsers, setApprovedUsers] = useState([]);
    const [accessRequests, setAccessRequests] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [loadingRequests, setLoadingRequests] = useState(true);
    const [showEditModal, setShowEditModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [prebookings, setPrebookings] = useState([]);
    const [selectedPrebookingIds, setSelectedPrebookingIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState([]);
    const [showBankAssign, setShowBankAssign] = useState(false);
    const [selectedBankUsers, setSelectedBankUsers] = useState([]);

    const [showLockerAssign, setShowLockerAssign] = useState(false);
    const [selectedLockerUsers, setSelectedLockerUsers] = useState([]);

    const fetchData = async () => {
        try {
            const usersSnap = await getDocs(collection(db, "usersAccess"));
            const allUsers = usersSnap.docs
                .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
                .filter(user => user.accessToApp !== "A");

            setUsers(allUsers);

        } catch (err) {
            console.error("Error fetching data:", err);
        }
    };

    useEffect(() => {
        const fetchAssignedUsers = async () => {
            try {
                // Bank assignments
                const bankSnap = await getDoc(doc(db, "accountant", "AssignBank"));
                if (bankSnap.exists()) {
                    setSelectedBankUsers(bankSnap.data().users || []);
                }

                // Locker assignments
                const lockerSnap = await getDoc(doc(db, "accountant", "AssignLocker"));
                if (lockerSnap.exists()) {
                    setSelectedLockerUsers(lockerSnap.data().users || []);
                }
            } catch (err) {
                console.error("Error fetching assigned users:", err);
            }
        };

        fetchAssignedUsers();
    }, []);

    useEffect(() => {
        fetchData();
    }, []);

    const openEditPopup = async (user) => {
        setSelectedUser(user);
        setShowEditModal(true);

        const snapshot = await getDocs(collection(db, 'prebookings'));
        let allPrebookings = [];

        snapshot.forEach((docSnap) => {
            const monthId = docSnap.id;
            const monthData = docSnap.data();

            Object.entries(monthData).forEach(([bookingId, bookingData]) => {
                allPrebookings.push({
                    id: bookingId,
                    monthId: monthId,
                    ...bookingData
                });
            });
        });

        setPrebookings(allPrebookings);
        setSelectedPrebookingIds(user.editablePrebookings || []);
    };

    const saveEditPermissions = async () => {
        try {
            const userRef = doc(db, 'usersAccess', selectedUser.email);

            if (selectedPrebookingIds.length > 0) {
                // ✅ ENABLE: give access
                await updateDoc(userRef, {
                    editablePrebookings: selectedPrebookingIds,
                    editData: "enable"
                });

                setApprovedUsers(prev =>
                    prev.map(user =>
                        user.email === selectedUser.email
                            ? { ...user, editablePrebookings: selectedPrebookingIds, editData: "enable" }
                            : user
                    )
                );
            } else {
                // ❌ DISABLE: revoke access
                await updateDoc(userRef, {
                    editablePrebookings: [],
                    editData: "disable"
                });

                setApprovedUsers(prev =>
                    prev.map(user =>
                        user.email === selectedUser.email
                            ? { ...user, editablePrebookings: [], editData: "disable" }
                            : user
                    )
                );
            }

            alert("✅ Edit permissions updated.");
            setShowEditModal(false);
        } catch (err) {
            console.error(err);
            alert("Error saving permissions.");
        }
    };

    useEffect(() => {
        const fetchApprovedUsers = async () => {
            setLoadingUsers(true);
            const snapshot = await getDocs(collection(db, 'usersAccess'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setApprovedUsers(data.filter(user => user.accessToApp && user.accessToApp !== 'A'));
            setLoadingUsers(false);
        };

        const fetchAccessRequests = async () => {
            setLoadingRequests(true);
            const snapshot = await getDocs(collection(db, 'accessRequests'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAccessRequests(data);
            setLoadingRequests(false);
        };

        fetchApprovedUsers();
        fetchAccessRequests();
    }, []);

    const toggleAccess = async (email, currentAccess) => {
        try {
            const newAccess = currentAccess === "enable" ? "disable" : "enable";
            await updateDoc(doc(db, "usersAccess", email), { access: newAccess });

            setApprovedUsers(prev =>
                prev.map(u =>
                    u.email === email ? { ...u, access: newAccess } : u
                )
            );
            alert(`🔁 Access ${newAccess === "enable" ? "enabled" : "disabled"} for ${email}`);
        } catch (err) {
            console.error(err);
            alert("Error toggling access.");
        }
    };

    const handleApprove = async (request) => {
        try {
            await setDoc(doc(db, 'usersAccess', request.email), {
                name: request.name,
                email: request.email,
                accessToApp: request.currentApp,
                access: "enable",
                editData: "disable",
                approvedAt: new Date().toISOString()
            });

            await deleteDoc(doc(db, 'accessRequests', request.email));
            setAccessRequests(prev => prev.filter(r => r.email !== request.email));

            setApprovedUsers(prev => [
                ...prev,
                {
                    name: request.name,
                    email: request.email,
                    accessToApp: request.currentApp,
                    access: "enable",
                    editData: "disable",
                    approvedAt: new Date().toISOString()
                }
            ]);

            alert(`✅ Access granted to ${request.name}`);
        } catch (err) {
            console.error(err);
            alert("Error approving request.");
        }
    };

    const handleReject = async (request) => {
        try {
            await deleteDoc(doc(db, 'accessRequests', request.email));
            setAccessRequests(prev => prev.filter(r => r.email !== request.email));
            alert(`❌ Rejected request from ${request.name}`);
        } catch (err) {
            console.error(err);
            alert("Error rejecting request.");
        }
    };

    const accessMap = {
        D: "Partner",
        B: "Management",
        F: "Accountant",
        G: "User",
        C: "Vendor",
        E: "Decoration"
    };

    return (
        <div className="access-panel-wrapper">
            <div> <BackButton />  </div>

            <div style={{
                marginTop: "20px",
                display: "flex",
                justifyContent: "flex-end",
                gap: "12px",
            }}
            >
                <button
                    onClick={() => {
                        setShowBankAssign(!showBankAssign);
                        setShowLockerAssign(false);
                    }}
                    style={{
                        padding: "8px 16px",
                        background: "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                        transition: "0.3s",
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = "#0056b3")}
                    onMouseOut={e => (e.currentTarget.style.background = "#007bff")}
                >
                    Assign Bank
                </button>

                <button
                    onClick={() => {
                        setShowLockerAssign(!showLockerAssign);
                        setShowBankAssign(false);
                    }}
                    style={{
                        padding: "8px 16px",
                        background: "#c93fc9ff",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                        transition: "0.3s",
                    }}
                    onMouseOver={e => (e.currentTarget.style.background = "#881d88ff")}
                    onMouseOut={e => (e.currentTarget.style.background = "#c93fc9ff")}
                >
                    Assign Locker
                </button>
            </div>

            {showBankAssign && (
                <div className="assign-container bank-assign">
                    <button
                        onClick={() => setShowBankAssign(false)}
                        className="close-btn"
                    >
                        ✕
                    </button>
                    <h3 className="assign-title">Assign - Bank</h3>

                    <div className="table-responsive">
                        <table className="assign-table">
                            <thead>
                                <tr>
                                    <th>Assign</th>
                                    <th>Name</th>
                                    <th>Access</th>
                                    <th>Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td className="center">
                                            <input
                                                type="checkbox"
                                                value={u.id}
                                                checked={selectedBankUsers.some((user) => user.id === u.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedBankUsers((prev) => [...prev, u]);
                                                    else setSelectedBankUsers((prev) => prev.filter((user) => user.id !== u.id));
                                                }}
                                                className="custom-checkbox bank-checkbox"
                                            />
                                        </td>
                                        <td>{u.name}</td>
                                        <td>{accessMap[u.accessToApp] || u.accessToApp}</td>
                                        <td>{u.email}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="btn-container">
                        <button
                            onClick={async () => {
                                try {
                                    await setDoc(doc(db, "accountant", "AssignBank"), {
                                        type: "Bank",
                                        users: selectedBankUsers.map((u) => ({
                                            id: u.id,
                                            name: u.name,
                                            email: u.email,
                                            accessToApp: u.accessToApp,
                                        })),
                                        updatedAt: new Date().toISOString(),
                                    });
                                    setShowBankAssign(false);
                                } catch (err) {
                                    console.error(err);
                                    alert("Error saving bank assignment ❌");
                                }
                            }}
                            className="save-btn"
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}

            {showLockerAssign && (
                <div className="assign-container locker-assign">
                    <button onClick={() => setShowLockerAssign(false)} className="close-btn">✕</button>
                    <h3 className="assign-title">Assign - Locker</h3>

                    <div className="table-responsive">
                        <table className="assign-table">
                            <thead>
                                <tr>
                                    <th >Assign</th>
                                    <th >Name</th>
                                    <th >Access</th>
                                    <th >Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td className="center">
                                            <input
                                                type="checkbox"
                                                value={u.id}
                                                checked={selectedLockerUsers.some(user => user.id === u.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedLockerUsers(prev => [...prev, u]);
                                                    else setSelectedLockerUsers(prev => prev.filter(user => user.id !== u.id));
                                                }}
                                                className="custom-checkbox locker-checkbox"
                                                onMouseOver={e => e.currentTarget.style.transform = "scale(1.2)"}  // hover effect
                                                onMouseOut={e => e.currentTarget.style.transform = "scale(1)"}
                                            />
                                        </td>
                                        <td>{u.name}</td>
                                        <td>
                                            {accessMap[u.accessToApp] || u.accessToApp}
                                        </td>
                                        <td>{u.email}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="btn-container">
                        <button
                            onClick={async () => {
                                try {
                                    await setDoc(doc(db, "accountant", "AssignLocker"), {
                                        type: "Locker",
                                        users: selectedLockerUsers.map(u => ({ id: u.id, name: u.name, email: u.email, accessToApp: u.accessToApp })),
                                        updatedAt: new Date().toISOString(),
                                    });
                                    setShowLockerAssign(false);
                                } catch (err) {
                                    console.error(err);
                                    alert("Error saving locker assignment ❌");
                                }
                            }}
                            className="save-btn"
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}

            <div className="assign-container access-requests">
                <h2 className="assign-title">🧑‍💼 Access Requests</h2>
                {loadingRequests ? (
                    <p>Loading requests...</p>
                ) : accessRequests.length === 0 ? (
                    <p>No pending access requests.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="assign-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>App Requested</th>
                                    <th>Requested At</th>
                                    <th>Approve</th>
                                    <th>Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accessRequests.map((r, i) => (
                                    <tr key={i}>
                                        <td>{r.name}</td>

                                        <td>
                                            {r.currentApp === "B"
                                                ? "Main"
                                                : r.currentApp === "C"
                                                    ? "Vendor"
                                                    : r.currentApp === "D"
                                                        ? "Partner"
                                                        : r.currentApp === "E"
                                                            ? "Decoration"
                                                            : r.currentApp === "F"
                                                                ? "Accountant"
                                                                : "Unknown"}
                                        </td>
                                        <td>
                                            {new Date(r.requestedAt).toLocaleDateString()}{" "}
                                            {new Date(r.requestedAt).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                hour12: true,
                                            })}
                                        </td>
                                        <td className="button-group">
                                            <div>
                                                <button
                                                    className="button approve"
                                                    onClick={() => handleApprove(r)}
                                                >
                                                    Approve
                                                </button>
                                            </div>
                                            <div style={{ display: 'none' }}>
                                                <button
                                                    className="button reject"
                                                    onClick={() => handleReject(r)}
                                                >
                                                    ❌
                                                </button>
                                            </div>
                                        </td>
                                        <td>{r.email}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="assign-container approved-users">
                <h2 className="assign-title">✅ Approved Users</h2>
                {loadingUsers ? (
                    <p>Loading approved users...</p>
                ) : approvedUsers.length === 0 ? (
                    <p>No approved users found.</p>
                ) : (
                    <div className="table-responsive">
                        <table className="assign-table">
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>App Access</th>
                                    <th>Approved At</th>
                                    <th>Edit Access</th>
                                    <th>Actions</th>
                                    <th>Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                {approvedUsers.map((u, i) => (
                                    <tr key={i}>
                                        <td>{u.name}</td>
                                        <td>
                                            {u.accessToApp === "B"
                                                ? "Main"
                                                : u.accessToApp === "C"
                                                    ? "Vendor"
                                                    : u.accessToApp === "D"
                                                        ? "Partner"
                                                        : u.accessToApp === "E"
                                                            ? "Decoration"
                                                            : "Unknown"}
                                        </td>
                                        <td>
                                            {new Date(u.approvedAt).toLocaleDateString()}{" "}
                                            {new Date(u.approvedAt).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                hour12: true,
                                            })}
                                        </td>
                                        <td>
                                            {u.editData === "enable" ? (
                                                <button
                                                    className="button edit-enabled"
                                                    onClick={async () => {
                                                        const userRef = doc(db, "usersAccess", u.email);
                                                        await updateDoc(userRef, {
                                                            editablePrebookings: [],
                                                            editData: "disable",
                                                        });

                                                        setApprovedUsers((prev) =>
                                                            prev.map((user) =>
                                                                user.email === u.email
                                                                    ? { ...user, editablePrebookings: [], editData: "disable" }
                                                                    : user
                                                            )
                                                        );

                                                        alert(`🚫 Edit access disabled for ${u.name}`);
                                                    }}
                                                >
                                                    Editing Enabled
                                                </button>
                                            ) : (
                                                <button
                                                    className="button edit-data"
                                                    onClick={() => openEditPopup(u)}
                                                >
                                                    Grant Access
                                                </button>
                                            )}
                                        </td>
                                        <td>
                                            <button
                                                className={`button ${u.access === "enable" ? "enable" : "disable"}`}
                                                onClick={() => toggleAccess(u.email, u.access)}
                                            >
                                                {u.access === "enable" ? "Enabled" : "Disabled"}
                                            </button>
                                        </td>
                                        <td>{u.email}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Modal
                isOpen={showEditModal}
                onRequestClose={() => setShowEditModal(false)}
                contentLabel="Edit Access Modal"
                className="modal"
                overlayClassName="overlay"
            >
                <div
                    style={{
                        marginTop: "20px",
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "10px",
                    }}
                >
                    <button onClick={() => setShowEditModal(false)}>Cancel</button>
                </div>

                <h2>Grant Edit Access: {selectedUser?.name}</h2>

                {/* Search Input */}
                <input
                    type="text"
                    placeholder="Search by name, event, mobile..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
                    style={{
                        width: "100%",
                        padding: "8px",
                        marginBottom: "12px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                    }}
                />

                {/* Select / Unselect Button */}
                <button
                    style={{ marginBottom: "12px", padding: "6px 12px" }}
                    onClick={() => {
                        const filteredIds = prebookings
                            .filter((p) => {
                                const name = p.name?.toLowerCase() || "";
                                const mobile1 = p.mobile1 || "";
                                const event = p.functionType?.toLowerCase() || "";
                                return (
                                    name.includes(searchTerm) ||
                                    event.includes(searchTerm) ||
                                    mobile1.includes(searchTerm)
                                );
                            })
                            .map((p) => p.id);

                        const allSelected = filteredIds.every((id) =>
                            selectedPrebookingIds.includes(id)
                        );

                        setSelectedPrebookingIds((prev) =>
                            allSelected
                                ? prev.filter((id) => !filteredIds.includes(id)) // unselect all filtered
                                : [...new Set([...prev, ...filteredIds])] // select all filtered
                        );
                    }}
                >
                    {(() => {
                        const filteredIds = prebookings
                            .filter((p) => {
                                const name = p.name?.toLowerCase() || "";
                                const mobile1 = p.mobile1 || "";
                                const event = p.functionType?.toLowerCase() || "";
                                return (
                                    name.includes(searchTerm) ||
                                    event.includes(searchTerm) ||
                                    mobile1.includes(searchTerm)
                                );
                            })
                            .map((p) => p.id);

                        const allSelected = filteredIds.every((id) =>
                            selectedPrebookingIds.includes(id)
                        );

                        return allSelected ? "Unselect All (Filtered)" : "Select All (Filtered)";
                    })()}
                </button>

                {/* Prebookings List */}
                <div
                    style={{
                        maxHeight: "300px",
                        overflowY: "auto",
                        border: "1px solid #ccc",
                        padding: "10px",
                        borderRadius: "6px",
                    }}
                >
                    {prebookings
                        .filter((p) => {
                            const name = p.name?.toLowerCase() || "";
                            const mobile1 = p.mobile1 || "";
                            const event = p.functionType?.toLowerCase() || "";
                            return (
                                name.includes(searchTerm) ||
                                event.includes(searchTerm) ||
                                mobile1.includes(searchTerm)
                            );
                        })
                        .map((p) => (
                            <div key={p.id} style={{ marginBottom: "6px" }}>
                                <label style={{ cursor: "pointer" }}>
                                    <input
                                        type="checkbox"
                                        checked={selectedPrebookingIds.includes(p.id)}
                                        onChange={(e) => {
                                            const checked = e.target.checked;
                                            setSelectedPrebookingIds((prev) =>
                                                checked
                                                    ? [...prev, p.id]
                                                    : prev.filter((id) => id !== p.id)
                                            );
                                        }}
                                    />
                                    {" "}
                                    <strong>{p.name || "No Name"}</strong> ({p.mobile1 || "N/A"}) –{" "}
                                    {p.functionType || "No Event"}
                                </label>
                            </div>
                        ))}
                </div>

                {/* Actions */}
                <div
                    style={{
                        marginTop: "20px",
                        display: "flex",
                        justifyContent: "center",
                        gap: "10px",

                    }}
                >
                    <button style={{ backgroundColor: 'green' }} onClick={saveEditPermissions}>Save Access</button>
                </div>
            </Modal>

        </div>
    );
};

export default UserAccessPanel;
