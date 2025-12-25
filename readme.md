# 🔥 Streaky

**Streaky** is a minimalist, data-driven habit tracker and task manager designed to help high performers own their habits and master their day. Built with a focus on simplicity and analytics, it allows users to visualize their progress through interactive charts and a GitHub-style commitment grid.

**🚀 Live Demo:** [https://streaky-03h9.onrender.com](https://streaky-03h9.onrender.com)

---

## 🛠️ Tech Stack

This project is a lightweight, full-stack web application built without heavy frameworks to ensure speed and simplicity.

* **Frontend:** HTML5, Tailwind CSS (via CDN), Vanilla JavaScript.
* **Backend:** Node.js, Express.js.
* **Database:** SQLite (Persistent local storage).
* **Authentication:** JWT (JSON Web Tokens) & Bcrypt.js.
* **Libraries:**
* `Chart.js` (Visual analytics).
* `SheetJS / xlsx` (Excel export).
* `FontAwesome` (Icons).



---

## ✨ Features

* **Habit Tracking:** Track boolean (Yes/No) or numeric habits (e.g., "Read 30 mins").
* **Visual Grid:** View your monthly progress in a calendar grid similar to GitHub contributions.
* **Analytics:** Visualize your weekly performance and deep-dive into numeric habit trends with line charts.
* **Task Management:** A simple to-do list for daily quick tasks.
* **Excel Export:** Export all your habit history data to an Excel file for personal analysis.
* **User Profiles:** Auto-detect location via IP or use precise GPS; track age and gender demographics.
* **Admin Panel:** Special dashboard for administrators to view user statistics and manage database entries.

---

## 📖 How to Use

### 1. Registration

To maintain privacy or exclusivity, registration requires an **Invite Code**.

* **Standard User Code:** `user@invitation`
* **Admin Access Code:** `princethakur24102005`

### 2. Dashboard

* **Weekly Score:** See your completion rate for the last 7 days.
* **Quick Tasks:** Add temporary tasks (like "Call Mom" or "Buy Milk"). These are separate from long-term habits.
* **Charts:** View bar charts for weekly consistency and line charts for specific numeric goals.

### 3. Habits Tab

* **Create a Habit:** Click "New Habit". Choose between:
* *Boolean:* Simple check-off (e.g., "Did you workout?").
* *Numeric:* Value tracking (e.g., "Water intake in liters") with a daily target.


* **Log Data:**
* Click a box in the grid to toggle a checkmark (Boolean).
* Type a number into the box for numeric habits.
* *Note:* Green cells indicate you met your numeric target; blue indicates progress.


* **Navigation:** Use the arrows to switch between months.

### 4. Admin Panel

* Log in using the Admin Code.
* Access the panel via the Profile Dropdown -> "Admin Panel".
* View total users, habits, and system health status.

---

## 🔧 Local Installation

If you want to run this locally:

1. **Clone the repository:**
```bash
git clone https://github.com/yourusername/streaky.git
cd streaky

```


2. **Install dependencies:**
```bash
npm install

```


3. **Start the server:**
```bash
npm start

```


4. **Access the app:**
Open your browser and navigate to `http://localhost:3000`.

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---