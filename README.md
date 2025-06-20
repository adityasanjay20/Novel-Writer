# Novel Writing Studio

A full-stack, single-page application for long-form writing, designed to provide a structured and tracked writing environment.

### [Live Demo](https://my-novel-studio.vercel.app)

---

## Core Functionality

This application enables writers to break down large manuscripts into smaller, manageable scenes or chapters. It provides a clean, distraction-free editor and tracks user progress through timed writing sessions. All data is saved in real-time to a secure cloud database, allowing for a persistent and reliable user experience across devices.

### Feature Breakdown

- **Project-Based Workflow:** All work is organized into distinct projects.
- **Scene Management:** Each project is composed of individual scenes which can be created, renamed, reordered, and deleted.
- **Drag-and-Drop Binder:** Scene order can be manipulated via a drag-and-drop interface in the sidebar.
- **Session Tracking:** Users can start and stop timed writing sessions to measure productivity. Key metrics like duration and words written are saved per session.
- **Scene Versioning (Snapshots):** At the end of each session, a snapshot of the active scene's content is saved. Users can view this history and revert the scene to any previous version.
- **Live Statistics:** A dedicated panel displays real-time statistics for both the overall project (total words, time, scenes) and the currently active scene.
- **Cloud Persistence:** All data is stored securely in the cloud and synced in real-time.
- **User Authentication:** A seamless anonymous authentication system ensures each user's work is private to them.

---

## Technical Implementation

This application is built with a modern web development stack, separating frontend logic from backend services.

### Frontend

- **React:** The core of the user interface is built as a single-page application using React.
- **State Management:** Component-level state and application logic are managed using React Hooks (`useState`, `useEffect`, `useRef`).
- **Styling:** The UI is styled using **Tailwind CSS**, following a utility-first methodology for rapid and consistent design.
- **Drag and Drop:** Scene reordering is implemented using **@hello-pangea/dnd**, a modern library for accessible drag-and-drop functionality in React.

### Backend

- **Firebase:** The entire backend is powered by Google's Firebase platform.
- **Firestore:** A NoSQL cloud database is used for all data storage. The data is structured hierarchically with projects stored in a top-level collection, and each project document containing its own array of scene and session objects.
- **Authentication:** Firebase Authentication is used to handle user sessions. Currently configured for anonymous sign-in to create a unique, persistent user ID without requiring an email or password.
- **Deployment:** The application is deployed and hosted on **Vercel**, with a CI/CD pipeline connected directly to the GitHub repository for continuous integration and deployment.

---

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repo:**
   ```sh
   git clone https://github.com/adityasanjay20/novel-writer.git
   cd novel-writer
   ```

2. **Install NPM packages:**
   ```sh
   npm install
   ```

3. **Set up environment variables:**
   
   Create a `.env.local` file in the project root and add your Firebase configuration:
   ```env
   REACT_APP_FIREBASE_API_KEY=YourApiKey
   REACT_APP_FIREBASE_AUTH_DOMAIN=YourAuthDomain
   REACT_APP_FIREBASE_PROJECT_ID=YourProjectId
   REACT_APP_FIREBASE_STORAGE_BUCKET=YourStorageBucket
   REACT_APP_FIREBASE_MESSAGING_SENDER_ID=YourMessagingSenderId
   REACT_APP_FIREBASE_APP_ID=YourAppId
   ```

4. **Start the development server:**
   ```sh
   npm start
   ```

The application will open in your browser at `http://localhost:3000`.

---

## Usage

1. **Create a Project:** Start by creating a new writing project
2. **Add Scenes:** Break your story into individual scenes or chapters
3. **Start Writing:** Use the clean editor interface to write your content
4. **Track Progress:** Start timed sessions to monitor your productivity
5. **Organize:** Drag and drop scenes to reorder your manuscript
6. **Version Control:** View snapshots of your work and revert to previous versions

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## Acknowledgments

- Built with [React](https://reactjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Backend powered by [Firebase](https://firebase.google.com/)
- Drag and drop functionality by [@hello-pangea/dnd](https://github.com/hello-pangea/dnd)
