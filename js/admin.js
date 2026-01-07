
// Configuration
const SUPABASE_URL = 'https://sxpgbpcdeozakyicqwoe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4cGdicGNkZW96YWt5aWNxd29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4MDM0NjAsImV4cCI6MjA4MzM3OTQ2MH0.It_LZwVYYy54opCaZ60GdiqdXn0b4ZtLLUDYD9vMsLQ';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Login Logic
document.getElementById('login-btn').addEventListener('click', () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === 'admin123') { // Simple demo password
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        loadBookings('upcoming');
    } else {
        alert('Contraseña incorrecta');
    }
});

function logout() {
    location.reload();
}

// Data Fetching
async function loadBookings(filterType) {
    const container = document.getElementById('bookings-list');
    container.innerHTML = '<p style="color: #666; text-align: center;">Cargando...</p>';

    try {
        let query = supabase
            .from('appointments')
            .select('*')
            .order('appointment_time', { ascending: true }); // Closest first

        if (filterType === 'upcoming') {
            const now = new Date().toISOString();
            query = query.gte('appointment_time', now).neq('status', 'cancelled');
        } else if (filterType === 'cancelled') {
            query = query.eq('status', 'cancelled');
        }

        const { data, error } = await query;

        if (error) throw error;

        renderBookings(data);

        // Update filter buttons UI
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        if (event && event.target && event.target.classList.contains('filter-btn')) {
            event.target.classList.add('active');
        }

    } catch (err) {
        console.error('Error:', err);
        container.innerHTML = '<p style="color: red; text-align: center;">Error al cargar datos.</p>';
    }
}

function renderBookings(bookings) {
    const container = document.getElementById('bookings-list');
    container.innerHTML = '';

    if (bookings.length === 0) {
        container.innerHTML = '<p style="color: #666; text-align: center; margin-top: 30px;">No hay reservas encontradas.</p>';
        return;
    }

    bookings.forEach(booking => {
        const date = new Date(booking.appointment_time);
        const day = date.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const time = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

        const card = document.createElement('div');
        card.className = `booking-card ${booking.status === 'cancelled' ? 'cancelled' : ''}`;

        const notesHtml = booking.notes ? `<div class="notes-box">"${booking.notes}"</div>` : '';
        const statusBadge = `<span class="status-badge status-${booking.status}">${booking.status}</span>`;

        card.innerHTML = `
            <div class="booking-info">
                <span class="booking-time">${day} - ${time}</span>
                <h4>${booking.client_name} ${statusBadge}</h4>
                <p><i class="fas fa-phone"></i> ${booking.client_phone} | <i class="fas fa-envelope"></i> ${booking.client_email}</p>
                ${notesHtml}
            </div>
            <div class="booking-actions">
                ${booking.status !== 'cancelled' ? `<button class="btn-cancel" onclick="cancelBooking('${booking.id}')">Cancelar</button>` : ''}
            </div>
        `;

        container.appendChild(card);
    });
}

async function cancelBooking(id) {
    if (!confirm('¿Seguro que quieres cancelar esta cita? El horario quedará libre.')) return;

    try {
        const { error } = await supabase
            .from('appointments')
            .update({ status: 'cancelled' })
            .eq('id', id);

        if (error) throw error;

        // Reload current view
        // Ideally we know the current filter, but defaulting to upcoming is fine for now
        loadBookings('upcoming');

    } catch (err) {
        alert('Error al cancelar: ' + err.message);
    }
}

// Expose filter function globally
window.filterBookings = loadBookings;
