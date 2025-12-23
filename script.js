/**
 * KUST LMS - Combined Frontend Logic
 */

/* --- Config --- */
const CONFIG = {
    API_BASE_URL: 'http://localhost:5000/api'
};

/* --- Global State --- */
const state = {
    user: null, // Token basically
    currentView: 'dashboard'
};

/* --- Utilities --- */
const toast = document.getElementById('toast');

function showToast(message, type = 'success') {
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

function getStatusColor(status) {
    switch (status && status.toLowerCase()) {
        case 'present': return 'rgba(16, 185, 129, 0.2)'; // Green
        case 'absent': return 'rgba(239, 68, 68, 0.2)';   // Red
        case 'late': return 'rgba(245, 158, 11, 0.2)';    // Yellow
        default: return 'rgba(148, 163, 184, 0.2)';       // Gray
    }
}

/* --- API Wrapper --- */
class API {
    static async request(endpoint, method = 'GET', body = null) {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const config = { method, headers };
        if (body) config.body = JSON.stringify(body);

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, config);
            if (response.status === 401) {
                // Token invalid
                Auth.logout();
                return null;
            }
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Something went wrong');
            return data;
        } catch (error) {
            console.error('API Error:', error);
            showToast(error.message, 'error');
            throw error;
        }
    }

    static async get(endpoint) { return this.request(endpoint, 'GET'); }
    static async post(endpoint, body) { return this.request(endpoint, 'POST', body); }
    static async put(endpoint, body) { return this.request(endpoint, 'PUT', body); }
    static async delete(endpoint) { return this.request(endpoint, 'DELETE'); }
}

/* --- Authentication --- */
const Auth = {
    isLoginMode: true,

    init() {
        const authForm = document.getElementById('auth-form');
        const toggleAuthBtn = document.getElementById('toggle-auth');
        
        if (toggleAuthBtn) {
            toggleAuthBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.isLoginMode = !this.isLoginMode;
                this.updateUI();
            });
        }

        if (authForm) {
            authForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Check login status on load
        if (localStorage.getItem('token')) {
            Router.showApp();
        } else {
            Router.showAuth();
        }
    },

    updateUI() {
        const title = document.getElementById('auth-title');
        const nameGroup = document.getElementById('name-group');
        const nameInput = document.getElementById('name');
        const btn = document.querySelector('#auth-form button');
        const toggleText = document.getElementById('toggle-text');
        const toggleBtn = document.getElementById('toggle-auth');

        if (this.isLoginMode) {
            title.textContent = 'Admin Login';
            nameGroup.style.display = 'none';
            nameInput.required = false;
            btn.textContent = 'Login';
            toggleText.textContent = "Don't have an account?";
            toggleBtn.textContent = 'Register';
        } else {
            title.textContent = 'Admin Register';
            nameGroup.style.display = 'block';
            nameInput.required = true;
            btn.textContent = 'Register';
            toggleText.textContent = 'Already have an account?';
            toggleBtn.textContent = 'Login';
        }
    },

    async handleSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        const endpoint = this.isLoginMode ? '/admin_login' : '/admin_register';
        const body = this.isLoginMode ? { email, password } : { name, email, password };

        try {
            // We use raw fetch here because API wrapper handles tokens automatically, 
            // but here we are establishing the token.
            const url = `${CONFIG.API_BASE_URL}${endpoint}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();

            if (response.ok) {
                if (this.isLoginMode) {
                    localStorage.setItem('token', data.token);
                    showToast('Login successful!', 'success');
                    Router.showApp();
                } else {
                    showToast('Registration successful! Please login.', 'success');
                    this.isLoginMode = true;
                    this.updateUI();
                }
            } else {
                showToast(data.message || 'Auth failed', 'error');
            }
        } catch (error) {
            console.error(error);
            showToast('Failed to connect to server', 'error');
        }
    },

    logout() {
        localStorage.removeItem('token');
        Router.showAuth();
    }
};

/* --- Students View --- */
const Students = {
    isEditing: false,

    init() {
        document.getElementById('save-student-btn').addEventListener('click', (e) => this.handleSubmit(e));
    },

    async load() {
        const tbody = document.getElementById('students-body');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';

        try {
            const data = await API.get('/show_student');
            tbody.innerHTML = '';
            
            // Handle both response formats if wrapper/backend varies
            const list = data.student || data; 

            if (list && list.length > 0) {
                list.forEach(student => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${student.id || '#'}</td>
                        <td>${student.name}</td>
                        <td>${student.email}</td>
                        <td>${student.admin_id}</td>
                        <td>
                            <button class="btn btn-primary" style="padding: 0.5rem;" onclick='Students.edit(${JSON.stringify(student).replace(/'/g, "&#39;")})'>Edit</button>
                            <button class="btn btn-danger" style="padding: 0.5rem;" onclick="Students.delete(${student.id})">Delete</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No students found</td></tr>';
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--error-color);">Failed to load students</td></tr>';
        }
    },

    openModal(isEdit = false) {
        const modal = document.getElementById('student-modal');
        modal.classList.add('active');
        document.getElementById('student-modal-title').textContent = isEdit ? 'Edit Student' : 'Add Student';
        if (!isEdit) {
            document.getElementById('student-form').reset();
            document.getElementById('student-id').value = '';
        }
        this.isEditing = isEdit;
    },

    edit(student) {
        if (!student.id) return showToast('Invalid student ID', 'error');
        this.openModal(true);
        document.getElementById('student-id').value = student.id;
        document.getElementById('student-name').value = student.name;
        document.getElementById('student-email').value = student.email;
        document.getElementById('student-password').value = '';
        document.getElementById('student-admin-id').value = student.admin_id;
    },

    async handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('student-id').value;
        const name = document.getElementById('student-name').value;
        const email = document.getElementById('student-email').value;
        const password = document.getElementById('student-password').value;
        const admin_id = document.getElementById('student-admin-id').value;
        const body = { name, email, password, admin_id };

        try {
            if (this.isEditing) {
                await API.put(`/update_student/${id}`, body);
                showToast('Student updated successfully');
            } else {
                await API.post('/student_register', body);
                showToast('Student added successfully');
            }
            Modals.closeAll();
            this.load();
        } catch (error) { /* Handled by API */ }
    },

    async delete(id) {
        if (!id || !confirm('Delete this student?')) return;
        try {
            await API.delete(`/delete_student/${id}`);
            showToast('Student deleted');
            this.load();
        } catch (error) { /* Handled by API */ }
    }
};

/* --- Teachers View --- */
const Teachers = {
    isEditing: false,

    init() {
        document.getElementById('save-teacher-btn').addEventListener('click', (e) => this.handleSubmit(e));
    },

    async load() {
        const tbody = document.getElementById('teachers-body');
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>';

        try {
            const data = await API.get('/show_teacher');
            tbody.innerHTML = '';
            const list = data.teacher || data;

            if (list && list.length > 0) {
                list.forEach(teacher => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${teacher.id || '#'}</td>
                        <td>${teacher.name}</td>
                        <td>${teacher.email}</td>
                        <td>${teacher.admin_id}</td>
                        <td>
                            <button class="btn btn-primary" style="padding: 0.5rem;" onclick='Teachers.edit(${JSON.stringify(teacher).replace(/'/g, "&#39;")})'>Edit</button>
                            <button class="btn btn-danger" style="padding: 0.5rem;" onclick="Teachers.delete(${teacher.id})">Delete</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No teachers found</td></tr>';
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--error-color);">Failed to load teachers</td></tr>';
        }
    },

    openModal(isEdit = false) {
        const modal = document.getElementById('teacher-modal');
        modal.classList.add('active');
        document.getElementById('teacher-modal-title').textContent = isEdit ? 'Edit Teacher' : 'Add Teacher';
        if (!isEdit) {
            document.getElementById('teacher-form').reset();
            document.getElementById('teacher-id').value = '';
        }
        this.isEditing = isEdit;
    },

    edit(teacher) {
        if (!teacher.id) return showToast('Invalid teacher ID', 'error');
        this.openModal(true);
        document.getElementById('teacher-id').value = teacher.id;
        document.getElementById('teacher-name').value = teacher.name;
        document.getElementById('teacher-email').value = teacher.email;
        document.getElementById('teacher-password').value = '';
        document.getElementById('teacher-admin-id').value = teacher.admin_id;
    },

    async handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('teacher-id').value;
        const name = document.getElementById('teacher-name').value;
        const email = document.getElementById('teacher-email').value;
        const password = document.getElementById('teacher-password').value;
        const admin_id = document.getElementById('teacher-admin-id').value;
        const body = { name, email, password, admin_id };

        try {
            if (this.isEditing) {
                await API.put(`/update_teacher/${id}`, body);
                showToast('Teacher updated successfully');
            } else {
                await API.post('/teacher_register', body);
                showToast('Teacher added successfully');
            }
            Modals.closeAll();
            this.load();
        } catch (error) { /* Handled by API */ }
    },

    async delete(id) {
        if (!id || !confirm('Delete this teacher?')) return;
        try {
            await API.delete(`/delete_teacher/${id}`);
            showToast('Teacher deleted');
            this.load();
        } catch (error) { /* Handled by API */ }
    }
};

/* --- Attendance View --- */
const Attendance = {
    isEditing: false,

    init() {
        document.getElementById('save-attendance-btn').addEventListener('click', (e) => this.handleSubmit(e));
    },

    async load() {
        const tbody = document.getElementById('attendance-body');
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Loading...</td></tr>';

        try {
            const data = await API.get('/attandence_show');
            tbody.innerHTML = '';
            const list = data.attandence || data;

            if (list && list.length > 0) {
                list.forEach(record => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${record.id || '#'}</td>
                        <td>${record.date}</td>
                        <td>
                            <span style="padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.8rem; background-color: ${getStatusColor(record.status)}">
                                ${record.status}
                            </span>
                        </td>
                        <td>${record.student_id}</td>
                        <td>${record.teacher_id}</td>
                        <td>
                            <button class="btn btn-primary" style="padding: 0.5rem;" onclick='Attendance.edit(${JSON.stringify(record).replace(/'/g, "&#39;")})'>Edit</button>
                            <button class="btn btn-danger" style="padding: 0.5rem;" onclick="Attendance.delete(${record.id})">Delete</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } else {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No records found</td></tr>';
            }
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error-color);">Failed to load attendance</td></tr>';
        }
    },

    openModal(isEdit = false) {
        const modal = document.getElementById('attendance-modal');
        modal.classList.add('active');
        document.getElementById('attendance-modal-title').textContent = isEdit ? 'Edit Record' : 'Add Record';
        if (!isEdit) {
            document.getElementById('attendance-form').reset();
            document.getElementById('attendance-id').value = '';
            document.getElementById('att-date').valueAsDate = new Date();
        }
        this.isEditing = isEdit;
    },

    edit(record) {
        if (!record.id) return showToast('Invalid record ID', 'error');
        this.openModal(true);
        document.getElementById('attendance-id').value = record.id;
        document.getElementById('att-date').value = record.date;
        document.getElementById('att-status').value = record.status;
        document.getElementById('att-student-id').value = record.student_id;
        document.getElementById('att-teacher-id').value = record.teacher_id;
        document.getElementById('att-admin-id').value = record.admin_id || 1;
    },

    async handleSubmit(e) {
        e.preventDefault();
        const id = document.getElementById('attendance-id').value;
        const date = document.getElementById('att-date').value;
        const status = document.getElementById('att-status').value;
        const student_id = document.getElementById('att-student-id').value;
        const teacher_id = document.getElementById('att-teacher-id').value;
        const admin_id = document.getElementById('att-admin-id').value;
        const body = { date, status, student_id, teacher_id, admin_id };

        try {
            if (this.isEditing) {
                await API.put(`/attandence_update/${id}`, body);
                showToast('Record updated successfully');
            } else {
                await API.post('/attendance', body);
                showToast('Record added successfully');
            }
            Modals.closeAll();
            this.load();
        } catch (error) { /* Handled by API */ }
    },

    async delete(id) {
        if (!id || !confirm('Delete this record?')) return;
        try {
            await API.delete(`/attendance_delete/${id}`);
            showToast('Record deleted');
            this.load();
        } catch (error) { /* Handled by API */ }
    }
};

/* --- Router & Navigation --- */
const Router = {
    init() {
        // Nav Links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                const target = e.target.getAttribute('data-target');
                if (target) {
                    e.preventDefault();
                    this.navigate(target);
                }
            });
        });

        // Initialize sub-modules
        Students.init();
        Teachers.init();
        Attendance.init();
    },

    showAuth() {
        document.getElementById('auth-container').style.display = 'flex';
        document.getElementById('app-content').style.display = 'none';
        
        // Reset login state UI if needed
        Auth.isLoginMode = true;
        Auth.updateUI();
    },

    showApp() {
        document.getElementById('auth-container').style.display = 'none';
        document.getElementById('app-content').style.display = 'block';
        this.navigate('dashboard');
    },

    navigate(viewName) {
        // Update active link
        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[data-target="${viewName}"]`);
        if (activeLink) activeLink.classList.add('active');

        // Update view
        document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
        const targetView = document.getElementById(`view-${viewName}`);
        if (targetView) targetView.classList.add('active');

        // Load data if needed
        if (viewName === 'students') Students.load();
        if (viewName === 'teachers') Teachers.load();
        if (viewName === 'attendance') Attendance.load();
    }
};

/* --- Modal Global --- */
const Modals = {
    init() {
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeAll());
        });
        
        // Close on click outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeAll();
            }
        });
    },

    closeAll() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    }
};

/* --- Initialization --- */
document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
    Router.init();
    Modals.init();
    
    // Global expose for existing inline onclicks (though we tried to remove them)
    // We should ensure HTML onclicks invoke these objects
    window.logout = () => Auth.logout();
});
