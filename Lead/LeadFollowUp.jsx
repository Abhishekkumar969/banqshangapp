import React, { useState, forwardRef, useImperativeHandle } from 'react';

const LeadFollowUp = forwardRef(({ form, handleChange }, ref) => {
    const [winError, setWinError] = useState(false);

    useImperativeHandle(ref, () => ({
        validateFollowUp: () => {
            const isValid = !!form.winProbability;
            setWinError(!isValid);
            return isValid;
        }
    }));

    const handleWinChange = (e) => {
        const range = e.target.value;
        let mid = '';

        switch (range) {
            case '0-25': mid = 12; break;
            case '25-50': mid = 38; break;
            case '50-75': mid = 62; break;
            case '75-100': mid = 88; break;
            default: mid = '';
        }

        const fakeEvent = {
            target: {
                name: 'winProbability',
                value: mid
            }
        };
        handleChange(fakeEvent);
    };

    return (
        <>
            <div className="form-group">
                <label>Booking Confirmation Probability</label>
                <select
                    onChange={handleWinChange}
                    value={
                        form.winProbability === 12 ? '0-25' :
                            form.winProbability === 38 ? '25-50' :
                                form.winProbability === 62 ? '50-75' :
                                    form.winProbability === 88 ? '75-100' : ''
                    }
                    style={{
                        backgroundColor:
                            form.winProbability === 12 ? '#f44336' :
                                form.winProbability === 38 ? '#ff9800' :
                                    form.winProbability === 62 ? '#ffeb3b' :
                                        form.winProbability === 88 ? '#4caf50' :
                                            '#fff',
                        color: 'black',
                        fontWeight: 'bold',
                        border: winError ? '1px solid red' : '1px solid #ccc',
                        padding: '8px',
                        borderRadius: '4px'
                    }}
                >
                    <option style={{ backgroundColor: 'white' }} value=""></option>
                    <option style={{ backgroundColor: 'white' }} value="0-25">0 - 25%</option>
                    <option style={{ backgroundColor: 'white' }} value="25-50">25 - 50%</option>
                    <option style={{ backgroundColor: 'white' }} value="50-75">50 - 75%</option>
                    <option style={{ backgroundColor: 'white' }} value="75-100">75 - 100%</option>
                </select>
                {winError && <span className="error">Required</span>}
            </div>


            <div className="form-group">
                <label>Hold Date</label>
                <input name="holdDate" type="date" onChange={handleChange} value={form.holdDate} />
            </div>

            {form.followUpDates.map((date, i) => (
                <div className="form-group" key={i} style={{ display: 'none' }}>
                    <label>{`Next Follow Up ${i + 1}`}</label>
                    <input
                        name="followUpDates"
                        type="date"
                        value={date}
                        onChange={(e) => handleChange(e, i)}
                    />
                </div>
            ))}
        </>
    );
});

export default LeadFollowUp;
