import React, { useState } from 'react';
import '../styles/LogPopupCell.css';

const VendorLogPopupCell = ({ vendor }) => {
    const [showLogs, setShowLogs] = useState(false);

    const parseCustomDate = (str) => {
        if (!str) return 0;
        const [datePart, timePart, meridiem] = str.match(/(\d+\/\d+\/\d+), (\d+:\d+:\d+) (am|pm)/i)?.slice(1) || [];
        if (!datePart || !timePart) return 0;

        const [day, month, year] = datePart.split('/').map(Number);
        let [hours, minutes, seconds] = timePart.split(':').map(Number);

        if (meridiem.toLowerCase() === 'pm' && hours < 12) hours += 12;
        if (meridiem.toLowerCase() === 'am' && hours === 12) hours = 0;

        return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
    };

    const updateLogs = vendor
        ? Object.keys(vendor)
            .filter(k => k.startsWith('updateLog'))
            .sort((a, b) => {
                const aTime = parseCustomDate(vendor[a]?.at);
                const bTime = parseCustomDate(vendor[b]?.at);
                return bTime - aTime;
            })
        : [];

    const formatDate = (isoString) => {
        if (!isoString) return "None";
        const date = new Date(isoString);
        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
        });
    };

    const renderValue = (val, fieldName) => {
        const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

        if (fieldName === "updatedAt") {
            return <span>{formatDate(val)}</span>;
        }

        // Handle services inside updateLog changes (new/old arrays)
        if (fieldName === "services" && isObject(val)) {
            return (
                <div style={{ marginTop: "6px", paddingLeft: "12px" }}>
                    {["old", "new"].map((type) =>
                        val[type]?.length > 0 ? (
                            <div key={type} style={{ marginBottom: "6px" }}>
                                <b>{type.toUpperCase()}:</b>
                                {val[type].map((item, i) => (
                                    <div key={i} style={{ paddingLeft: "12px", marginBottom: "2px" }}>
                                        • <b>{item.name}</b>
                                        {item.qty !== undefined && <> Qty: {item.qty},</>}
                                        {item.rate !== undefined && <> Rate: ₹{item.rate},</>}
                                        {item.royaltyAmount !== undefined && <> Royalty: ₹{item.royaltyAmount},</>}
                                        {item.royaltyPercent !== undefined && <> %: {item.royaltyPercent},</>}
                                        {item.total !== undefined && <> Total: ₹{item.total}</>}
                                    </div>
                                ))}
                            </div>
                        ) : null
                    )}
                </div>
            );
        }

        // Handle summary inside updateLog changes (new/old objects)
        if (fieldName === "summary" && isObject(val)) {
            return (
                <div style={{ marginTop: "6px", paddingLeft: "12px" }}>
                    {["old", "new"].map((type) =>
                        isObject(val[type]) ? (
                            <div key={type} style={{ marginBottom: "6px" }}>
                                <b>{type.toUpperCase()}:</b>
                                {Object.entries(val[type])
                                    .filter(([k]) => k !== "updatedAt") // <-- skip updatedAt
                                    .map(([k, v]) => (
                                        <div key={k} style={{ paddingLeft: "12px" }}>
                                            • <b>{k}:</b> {v}
                                        </div>
                                    ))}
                            </div>
                        ) : null
                    )}
                </div>
            );
        }

        // Handle generic arrays of objects
        if (Array.isArray(val)) {
            return val.length ? (
                <div style={{ marginTop: "6px", paddingLeft: "12px" }}>
                    {val.map((item, i) => (
                        <div key={i} style={{ marginBottom: "4px" }}>
                            {isObject(item) ? (
                                Object.entries(item)
                                    .filter(([k]) => k !== "updatedAt") // <-- skip updatedAt
                                    .map(([k, v]) => (
                                        <div key={k}>
                                            <b>{k}:</b> {String(v ?? "None")}
                                        </div>
                                    ))
                            ) : (
                                <span>{String(item ?? "None")}</span>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <span>None</span>
            );
        }

        // Handle generic objects
        if (isObject(val)) {
            return (
                <div style={{ marginTop: "6px", paddingLeft: "12px" }}>
                    {Object.entries(val)
                        .filter(([k]) => k !== "updatedAt") // <-- skip updatedAt
                        .map(([k, v]) => (
                            <div key={k}>
                                <b>{k}:</b> {Array.isArray(v) ? `[Array]` : isObject(v) ? `[Object]` : v}
                            </div>
                        ))}
                </div>
            );
        }

        // Primitive fallback
        return <span>"{String(val ?? "None")}"</span>;
    };

    return (
        <td key={`${vendor.id}-logs`} style={{ textAlign: 'center' }}>
            <button
                onClick={() => setShowLogs(true)}
                className="log-popup-btn"
                disabled={updateLogs.length === 0} // Disable if no logs
                style={{
                    backgroundColor: updateLogs.length === 0 ? '#ccc' : '#2e86de', // Gray if disabled
                    cursor: updateLogs.length === 0 ? 'not-allowed' : 'pointer',
                    color: updateLogs.length === 0 ? '#666' : '#fff',
                }}
            >
                View Logs
            </button>

            {showLogs && (
                <div
                    className="log-popup-overlay"
                    onClick={(e) => {
                        if (e.target.classList.contains('log-popup-overlay')) {
                            setShowLogs(false);
                        }
                    }}
                >
                    <div className="log-popup-box">

                        <button className="log-popup-close" onClick={() => setShowLogs(false)}>✖</button>

                        <h3 className="log-popup-heading"> Update Logs for <b>{vendor.customerName}</b></h3>

                        {updateLogs.length === 0 && <p style={{ color: '#999' }}>No logs available.</p>}

                        {updateLogs.map((logKey) => {
                            const log = vendor[logKey];
                            if (!log?.changes) return null;

                            return (
                                <div className="log-entry" key={logKey}>
                                    <div>
                                        <b>Time:</b>{" "}
                                        {log.at
                                            ? log.at.seconds
                                                ? new Date(log.at.seconds * 1000).toLocaleString("en-GB", {
                                                    day: "2-digit",
                                                    month: "2-digit",
                                                    year: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                    second: "2-digit",
                                                    hour12: true,
                                                })
                                                : log.at
                                            : "Unknown time"}
                                    </div>
                                    {log.by && (
                                        <div className="log-by-info">
                                            <div>
                                                <b>By:</b>{" "}
                                                {log.by
                                                    ? `${log.by.name || "Unknown User"} (${log.by.email || "No email"})`
                                                    : "Unknown User"}
                                            </div>
                                        </div>
                                    )}

                                    <ul className="log-change-list">
                                        {Object.entries(log.changes || {}).map(([field, { old, new: newVal }], idx) => (
                                            <li key={idx} className="log-row">
                                                <div className="log-label">{field}</div>
                                                <div className="log-cols">
                                                    <div className="log-old-col">{renderValue(old, field)}</div>
                                                    <div className="log-arrow">→</div>
                                                    <div className="log-new-col">{renderValue(newVal, field)}</div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </td>
    );
};

export default VendorLogPopupCell;
