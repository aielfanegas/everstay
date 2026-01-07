
// Configuration - REPLACE THESE WITH YOUR SUPABASE PROJECT DETAILS
const SUPABASE_URL = 'https://sxpgbpcdeozakyicqwoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4cGdicGNkZW96YWt5aWNxd29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MDM0NjAsImV4cCI6MjA4MzM3OTQ2MH0.It_LZwVYYy54opCaZ60GdiqdXn0b4ZtLLUDYD9vMsLQ';

let supabase;

// Initialize Supabase
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
        console.error("Supabase init error:", e);
    }
}

// State
let selectedSlot = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Date Input
    const dateInput = document.getElementById('booking-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;

        // Handler
        const handleDateChange = () => {
            const val = dateInput.value;
            if (!val) return;

            selectedSlot = null;
            checkFormValidity();
            loadSlots();
        };

        // Multiple listeners to ensure we catch the update
        dateInput.addEventListener('change', handleDateChange);
        dateInput.addEventListener('input', handleDateChange);
        dateInput.addEventListener('blur', handleDateChange); // Also on lose focus

        // If pre-filled (e.g. browser cache)
        if (dateInput.value) {
            handleDateChange();
        }
    }

    // 2. Listen to Input Changes for Validation
    const inputs = ['client-name', 'client-phone', 'client-email', 'client-notes'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', checkFormValidity);
    });

    // 3. Confirm Button Logic
    const confirmBtn = document.getElementById('confirm-booking-btn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmBooking);
    }

    // 4. Time Select Logic
    const timeSelect = document.getElementById('booking-time-select');
    if (timeSelect) {
        timeSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                selectedSlot = new Date(e.target.value);
            } else {
                selectedSlot = null;
            }
            checkFormValidity();
        });
    }
});

function checkFormValidity() {
    const name = document.getElementById('client-name').value.trim();
    const phone = document.getElementById('client-phone').value.trim();
    const email = document.getElementById('client-email').value.trim();
    const date = document.getElementById('booking-date').value;
    const confirmBtn = document.getElementById('confirm-booking-btn');

    // Check if basic fields are filled AND a slot is selected
    if (name && phone && email && date && selectedSlot) {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
        confirmBtn.style.cursor = 'pointer';
    } else {
        confirmBtn.disabled = true;
        confirmBtn.style.opacity = '0.6';
        confirmBtn.style.cursor = 'not-allowed';
    }
}

async function loadSlots() {
    const dateStr = document.getElementById('booking-date').value;
    const slotsSection = document.getElementById('slots-section');
    const select = document.getElementById('booking-time-select');
    const spinner = document.getElementById('loading-slots');

    // Safety check for UI elements
    if (!slotsSection || !select || !spinner) {
        console.error("Missing booking UI elements");
        return;
    }

    if (!dateStr) {
        slotsSection.style.display = 'none';
        return;
    }

    // Force display immediately
    slotsSection.style.display = 'block';
    spinner.style.display = 'block';

    // Initial State of Select
    select.innerHTML = '<option value="">Cargando...</option>';
    select.disabled = true;

    // Check for weekends
    const dateObj = new Date(dateStr);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        spinner.style.display = 'none';
        select.innerHTML = '<option value="">Cerrado (Lun-Vie)</option>';
        select.disabled = true;
        return;
    }

    // Rules: 9-14 and 17-21 (Spanish Time)
    const hours = [9, 10, 11, 12, 13, 17, 18, 19, 20];

    try {
        const startOfDay = new Date(dateStr);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateStr);
        endOfDay.setHours(23, 59, 59, 999);

        let occupied = new Set();

        if (supabase) {
            const { data: existing, error } = await supabase
                .from('appointments')
                .select('appointment_time')
                .gte('appointment_time', startOfDay.toISOString())
                .lte('appointment_time', endOfDay.toISOString())
                .neq('status', 'cancelled'); // Don't block cancelled slots

            if (error) {
                console.error("Supabase Error:", error);
                throw error;
            }
            if (existing) {
                occupied = new Set(existing.map(r => new Date(r.appointment_time).toISOString()));
            }
        }

        const year = parseInt(dateStr.split('-')[0]);
        const month = parseInt(dateStr.split('-')[1]) - 1;
        const day = parseInt(dateStr.split('-')[2]);

        // Clear and Populate Select
        select.innerHTML = '<option value="">Selecciona una hora...</option>';
        select.disabled = false;

        let slotsFound = 0;
        hours.forEach(hour => {
            const slotDate = new Date(year, month, day, hour, 0, 0);
            const timeLabel = `${hour}:00 - ${hour + 1}:00`;

            // Check blocking (1 min tolerance)
            const isBlocked = Array.from(occupied).some(occTime => {
                const appTime = new Date(occTime);
                return Math.abs(appTime - slotDate) < 60000;
            });

            if (!isBlocked) {
                const option = document.createElement('option');
                option.value = slotDate.toISOString();
                option.text = timeLabel;
                select.appendChild(option);
                slotsFound++;
            }
        });

        if (slotsFound === 0) {
            const option = document.createElement('option');
            option.text = "¡Completo! No hay huecos libres.";
            option.disabled = true;
            select.appendChild(option);
        }

    } catch (err) {
        console.error('Error fetching slots:', err);
        select.innerHTML = '<option>Error cargando disponibilidad</option>';
        select.disabled = true;
    } finally {
        spinner.style.display = 'none';
        selectedSlot = null; // Reset selection on new date load
        checkFormValidity();
    }
}

async function confirmBooking() {
    if (!selectedSlot) return;

    const name = document.getElementById('client-name').value;
    const phone = document.getElementById('client-phone').value;
    const email = document.getElementById('client-email').value;
    const notes = document.getElementById('client-notes').value;

    const btn = document.getElementById('confirm-booking-btn');
    const originalText = btn.textContent;
    btn.textContent = 'Reservando...';
    btn.disabled = true;

    try {
        if (!supabase) throw new Error('Supabase not configured');

        const { error } = await supabase
            .from('appointments')
            .insert({
                client_name: name,
                client_phone: phone,
                client_email: email,
                appointment_time: selectedSlot.toISOString(),
                notes: notes,
                status: 'confirmed'
            });

        if (error) {
            if (error.code === '23505') {
                alert('¡Vaya! Alguien acaba de reservar este hueco. Por favor elige otro.');
                loadSlots();
                selectedSlot = null;
                checkFormValidity();
            } else {
                throw error;
            }
        } else {
            // Success Animation
            document.getElementById('booking-form-container').style.display = 'none';
            document.getElementById('booking-success').style.display = 'block';
        }
    } catch (err) {
        console.error('Error booking:', err);
        alert('Hubo un error al reservar. Por favor inténtalo de nuevo.');
    } finally {
        btn.textContent = originalText;
        if (selectedSlot) btn.disabled = false;
    }
}
