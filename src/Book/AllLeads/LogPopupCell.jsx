import React, { useState } from 'react';
import '../../styles/LogPopupCell.css';

const LogPopupCell = ({ lead }) => {
    const [showLogs, setShowLogs] = useState(false);

    const updateLogs = Object.keys(lead)
        .filter(k => k.startsWith('updateLog'))
        .sort((a, b) => {
            const aTime = lead[a]?.at?.seconds || 0;
            const bTime = lead[b]?.at?.seconds || 0;
            return bTime - aTime;
        });

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

        if (fieldName === "updatedAt") {
            return <span>{formatDate(val)}</span>;
        }

        if (fieldName === 'customItems' && Array.isArray(val)) {
            return (
                <div style={{ marginTop: '6px' }}>
                    {val.map((item, i) => (
                        <div key={i} style={{ marginBottom: '4px', paddingLeft: '12px' }}>
                            • <b>{item.name}</b>
                            {item.qty !== undefined && <> Qty: {item.qty},</>}
                            {item.rate !== undefined && <> Rate: ₹{item.rate},</>}
                            {item.total !== undefined && <> Total: ₹{item.total}</>}
                        </div>
                    ))}
                </div>
            );
        }

        if (fieldName === 'bookingAmenities' && Array.isArray(val)) {
            return (
                <div style={{ marginTop: '6px' }}>
                    {val.map((item, i) => (
                        <div key={i} style={{ marginBottom: '4px', paddingLeft: '12px' }}>
                            • {item}
                        </div>
                    ))}
                </div>
            );
        }

        if (fieldName === 'selectedMenus' && typeof val === 'object' && val !== null) {
            return (
                <div style={{ marginTop: '6px', paddingLeft: '12px' }}>
                    {Object.entries(val).map(([menuName, data], i) => (
                        <div key={i} style={{ marginBottom: '4px' }}>
                            🍽️ <b>{menuName}</b> - Qty: {data.qty}, Rate: ₹{data.rate}, Total: ₹{data.total}
                        </div>
                    ))}
                </div>
            );
        }

        if (fieldName === 'meals' && val?.Breakfast) {
            const bf = val.Breakfast;
            return (
                <div className="meal-block" style={{ paddingLeft: '12px', marginTop: '6px' }}>
                    🍳 <b>Breakfast</b><br />
                    • Time: {bf.startTime} - {bf.endTime}<br />
                    • Pax: {bf.pax}<br />
                    • Rate: ₹{bf.rate}<br />
                    • Total: ₹{bf.total}<br />
                </div>
            );
        }

        if (Array.isArray(val)) {
            return <span>{val.length === 0 ? 'None' : '[Array]'}</span>;
        }

        if (typeof val === 'object' && val !== null) {
            return <span>[Object]</span>;
        }

        return <span>"{String(val || 'None')}"</span>;
    };

    const generatePrintableValue = (val, fieldName) => {
        if (fieldName === 'customItems' && Array.isArray(val)) {
            return val.map(item =>
                `• <b>${item.name}</b>${item.qty !== undefined ? ` Qty: ${item.qty},` : ''}${item.rate !== undefined ? ` Rate: ₹${item.rate},` : ''}${item.total !== undefined ? ` Total: ₹${item.total}` : ''}`
            ).join('<br>');
        }

        if (fieldName === 'bookingAmenities' && Array.isArray(val)) {
            return val.map(item => `• ${item}`).join('<br>');
        }

        if (fieldName === 'selectedMenus' && typeof val === 'object' && val !== null) {
            return Object.entries(val).map(([menuName, data]) =>
                `🍽️ <b>${menuName}</b> - Qty: ${data.qty}, Rate: ₹${data.rate}, Total: ₹${data.total}`
            ).join('<br>');
        }

        if (fieldName === 'meals' && val?.Breakfast) {
            const bf = val.Breakfast;
            return `
          🍳 <b>Breakfast</b><br>
          • Time: ${bf.startTime} - ${bf.endTime}<br>
          • Pax: ${bf.pax}<br>
          • Rate: ₹${bf.rate}<br>
          • Total: ₹${bf.total}
        `;
        }

        if (Array.isArray(val)) return val.length === 0 ? 'None' : '[Array]';
        if (typeof val === 'object' && val !== null) return '[Object]';
        return `"${String(val || 'None')}"`;
    };

    const generatePrintHTML = ({ lead, updateLogs }) => {
        const style = `
      <style>
        body {
          font-family: 'Segoe UI', Tahoma, sans-serif;
          padding: 30px;
          color: #111;
        }
        h2 {
          text-align: center;
          color: #2e86de;
          margin-bottom: 30px;
        }
        .log-entry {
          border-left: 6px solid #2e86de;
          padding: 18px;
          background: #f9f9f9;
          margin-bottom: 30px;
          page-break-inside: avoid;
        }
        .log-entry-header {
          display: flex;
          justify-content: space-between;
          font-weight: bold;
          margin-bottom: 10px;
          color: #333;
        }
        .log-label {
          font-weight: 600;
          margin: 12px 0 6px;
          font-size: 15px;
        }
        .log-cols {
          display: flex;
          gap: 16px;
        }
        .log-old-col, .log-new-col {
          width: 48%;
          padding: 12px;
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
        }
        .log-old-col {
          background: #ffeaea;
          color: #b51a1a;
        }
        .log-new-col {
          background: #e3ffe9;
          color: #186c3b;
        }
      </style>
    `;

        let content = `<html><head><title>Logs - ${lead.name}</title>${style}</head><body>`;
        content += `<h2>Update Logs for ${lead.name}</h2>`;

        if (updateLogs.length === 0) {
            content += `<p>No logs available.</p>`;
        }

        updateLogs.forEach((logKey) => {
            const log = lead[logKey];
            if (!log?.changes) return;

            content += `
          <div class="log-entry">
            <div class="log-entry-header">
              <div>📝 ${logKey}</div>
              <div>${log.at?.seconds ? new Date(log.at.seconds * 1000).toLocaleString('en-GB') : 'Unknown time'}</div>
            </div>
        `;

            Object.entries(log.changes).forEach(([field, { old, new: newVal }]) => {
                const oldValHTML = generatePrintableValue(old, field);
                const newValHTML = generatePrintableValue(newVal, field);

                content += `
              <div class="log-label">${field}</div>
              <div class="log-cols">
                <div class="log-old-col">${oldValHTML}</div>
                <div class="log-new-col">${newValHTML}</div>
              </div>
            `;
            });

            content += `</div>`;
        });

        content += `</body></html>`;
        return content;
    };

    const handlePrint = () => {
        const printWindow = window.open('', '', 'width=1000,height=800');
        const content = generatePrintHTML({ lead, updateLogs });
        printWindow.document.open();
        printWindow.document.write(content);
        printWindow.print();
    };

    return (
        <td key={`${lead.id}-logs`} style={{ textAlign: 'center' }}>
            {updateLogs.length > 0 && (
                <button
                    onClick={() => setShowLogs(true)}
                    className="log-popup-btn"
                    style={{
                        backgroundColor: "transparent",
                        border: "none",
                        margin: '0px',
                        display: 'flex',
                        justifyContent: 'center'
                    }}
                >
                    <img
                        src="../../assets/logs.png"
                        alt="Logs"
                        style={{ width: '30px', height: '30px' }}
                    />
                </button>
            )}

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
                        <button className="log-popup-print" onClick={handlePrint}>
                            🖨️ Print Logs
                        </button>
                        <h3 className="log-popup-heading"> Update Logs for <b>{lead.name}</b></h3>

                        {updateLogs.length === 0 && <p style={{ color: '#999' }}>No logs available.</p>}

                        {updateLogs.map((logKey) => {
                            const log = lead[logKey];
                            if (!log?.changes) return null;
                            return (
                                <div className="log-entry" key={logKey}>
                                    <div className="log-entry-header">
                                        <div className="log-id">📝 <strong>{logKey}</strong></div>
                                        <div className="log-timestamp">
                                            {log.at?.seconds
                                                ? new Date(log.at.seconds * 1000).toLocaleString('en-GB')
                                                : 'Unknown time'}
                                        </div>
                                    </div>

                                    {log.by && (
                                        <div className="log-by-info">
                                            <div><strong>By:</strong> {log.by.name || 'Unknown'} ({log.by.email || 'N/A'})</div>
                                        </div>
                                    )}

                                    <ul className="log-change-list">
                                        {Object.entries(log.changes).map(([field, { old, new: newVal }], idx) => (
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

export default LogPopupCell;
