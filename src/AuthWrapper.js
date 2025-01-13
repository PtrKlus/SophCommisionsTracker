import React, { useState, useEffect } from "react";
import { auth, provider } from "./firebase";
import { signInWithPopup, signOut } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase"; // Import Firestore

const AuthWrapper = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // List of allowed email addresses (for testing)
  const allowedUsers = ["alloweduser@example.com", "anotheruser@example.com"];

  // Fetch allowed users from Firestore (optional, for more dynamic control)
  const getAuthorizedUsers = async () => {
    try {
      const authorizedUsersRef = collection(db, "authorizedUsers");
      const snapshot = await getDocs(authorizedUsersRef);

      // Map over the snapshot to get the email field from each document
      const allowedEmails = snapshot.docs.map((doc) => doc.data().email);

      return allowedEmails;
    } catch (error) {
      console.error("Error fetching allowed users:", error);
      setError("Failed to check user authorization.");
    }
  };
  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setLoading(true);
      if (currentUser) {
        const checkIfAuthorized = async () => {
          const allowedEmails = await getAuthorizedUsers(); // Fetch the list of authorized users from Firestore
          if (
            allowedUsers.includes(currentUser.email) ||
            allowedEmails.includes(currentUser.email)
          ) {
            setUser(currentUser); // Allow access if user is authorized
          } else {
            setError("You are not authorized to log in.");
            signOut(auth); // Sign out the unauthorized user
          }
        };
        checkIfAuthorized();
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Fetch authorized users from Firestore and check
      const allowedEmails = await getAuthorizedUsers();
      if (
        allowedUsers.includes(user.email) ||
        allowedEmails.includes(user.email)
      ) {
        setUser(user); // Allow login if the user is on the list
      } else {
        setError("You are not authorized to log in.");
        signOut(auth); // Sign out the unauthorized user
      }
    } catch (error) {
      console.error("Error during sign-in:", error.message);
      setError("Something went wrong during sign-in.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error during sign-out:", error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  if (!user) {
    return (
      <div>
        <h2>Welcome! Please sign in to continue.</h2>
        <button onClick={handleGoogleSignIn}>Sign in with Google</button>
      </div>
    );
  }

  return (
    <div>
      <header>
        <p>Welcome, {user.displayName}!</p>
        <button onClick={handleSignOut}>Sign Out</button>
      </header>
      {children}
    </div>
  );
};

export default AuthWrapper;
