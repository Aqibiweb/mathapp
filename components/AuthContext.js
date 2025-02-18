import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthRequest, makeRedirectUri } from 'expo-auth-session';
import { AUTH0_DOMAIN, AUTH0_CLIENT_ID, BACKEND_URL } from '@env';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [user, setUser] = useState(null);
    const [tracks, setTracks] = useState(null);
    const [isSubscriber, setIsSubscriber] = useState(false);

    const discovery = {
        authorizationEndpoint: `https://${AUTH0_DOMAIN}/authorize`,
        tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
        revocationEndpoint: `https://${AUTH0_DOMAIN}/oauth/revoke`,
    };

    const [request, response, promptAsync] = useAuthRequest({
        clientId: AUTH0_CLIENT_ID,
        redirectUri: makeRedirectUri({ useProxy: true }),
        responseType: 'id_token token',
        scopes: ['openid', 'profile', 'email', 'offline_access'],
        extraParams: { nonce: 'uniqueNonce' },
    }, discovery);

    const checkToken = async () => {
        const storedToken = await AsyncStorage.getItem('userToken');
        if (storedToken) {
            console.log("storedToken: ", storedToken);
            validateToken(storedToken);
        } else {
            setIsAuthenticated(false);
            console.log ("going to auth0");
            promptAsync({ useProxy: true });
        }
    };

    useEffect(() => {
        checkToken();
    }, []);

    useEffect(() => {
        if (response?.type === 'success') {
            const { id_token } = response.params;
            AsyncStorage.setItem('userToken', id_token);
            validateToken(id_token);
        }
    }, [response]);

    const validateToken = async (token) => {
        try {
            const response = await fetch(`${BACKEND_URL}/validateToken`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
            });
            const data = await response.json();
            if (response.ok) {
                setIsAuthenticated(true);
                setUser(data.user);
                setTracks(data.tracks);
                setIsSubscriber(data.isSubscriber);
            } else {
                AsyncStorage.removeItem('userToken');
                setIsAuthenticated(false);
                promptAsync({ useProxy: true });  // Re-prompt for authentication if the token is invalid
            }
        } catch (error) {
            console.error('Validation Error:', error);
            setIsAuthenticated(false);
            AsyncStorage.removeItem('userToken');
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, user, tracks, isSubscriber, authenticate: promptAsync, checkToken }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);

export { AuthContext };
