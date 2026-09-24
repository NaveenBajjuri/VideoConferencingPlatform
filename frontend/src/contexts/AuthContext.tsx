import axios, { type InternalAxiosRequestConfig } from "axios";
import httpStatus from "http-status";
import React, { createContext, useContext, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import server from "../environment";

export const AuthContext = createContext<any>({});

const client = axios.create({
    baseURL: `${server}/api/v1/users`,
});

const meetingsClient = axios.create({
    baseURL: `${server}/api/v1/meetings`,
});

const attachToken = (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
};
client.interceptors.request.use(attachToken);
meetingsClient.interceptors.request.use(attachToken);

let refreshPromise: Promise<any> | null = null;
const attachRefreshInterceptor = (instance: typeof client) => {
    instance.interceptors.response.use(
        (res) => res,
        async (error) => {
            const originalRequest = error.config;
            const status = error.response?.status;

            if (status === httpStatus.UNAUTHORIZED && !originalRequest._retry) {
                originalRequest._retry = true;
                const refreshToken = localStorage.getItem("refreshToken");
                if (!refreshToken) return Promise.reject(error);

                try {
                    if (!refreshPromise) {
                        refreshPromise = axios
                            .post(`${server}/api/v1/users/refresh-token`, { refreshToken })
                            .finally(() => {
                                refreshPromise = null;
                            });
                    }
                    const { data } = await refreshPromise;
                    localStorage.setItem("token", data.accessToken);
                    localStorage.setItem("refreshToken", data.refreshToken);
                    originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
                    return instance(originalRequest);
                } catch (refreshErr) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("refreshToken");
                    return Promise.reject(refreshErr);
                }
            }

            return Promise.reject(error);
        }
    );
};
attachRefreshInterceptor(client);
attachRefreshInterceptor(meetingsClient);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const authContext = useContext(AuthContext);
    const [userData, setUserData] = useState<any>(authContext);
    const router = useNavigate();

    const handleRegister = async (name: string, username: string, password: string): Promise<string> => {
        const response = await client.post("/register", {
            name,
            username,
            password,
        });

        if (response.status === httpStatus.CREATED) {
            return response.data.message;
        }
        return "";
    };

    const handleLogin = async (username: string, password: string): Promise<void> => {
        const response = await client.post("/login", {
            username,
            password,
        });

        if (response.status === httpStatus.OK) {
            localStorage.setItem("token", response.data.accessToken || response.data.token);
            localStorage.setItem("refreshToken", response.data.refreshToken || "");
            setUserData((prev: any) => ({ ...prev, user: response.data.user }));
            router("/home");
        }
    };

    const handleLogout = async (): Promise<void> => {
        try {
            await client.post("/logout");
        } catch (e) {
            // Non-fatal
        } finally {
            localStorage.removeItem("token");
            localStorage.removeItem("refreshToken");
            router("/auth");
        }
    };

    const getHistoryOfUser = async (page: number = 1, limit: number = 10, search: string = ""): Promise<any> => {
        const response = await client.get("/get_all_activity", {
            params: { page, limit, search },
        });
        return response.data;
    };

    const addToUserHistory = async (meetingCode: string): Promise<any> => {
        const response = await client.post("/add_to_activity", {
            meeting_code: meetingCode,
        });
        return response;
    };

    const scheduleMeeting = async ({
        title,
        scheduledTime,
        invitedEmails,
    }: {
        title: string;
        scheduledTime: string | Date;
        invitedEmails: string[];
    }): Promise<any> => {
        const response = await meetingsClient.post("/schedule", {
            title,
            scheduledTime,
            invitedEmails,
            frontendOrigin: window.location.origin,
        });
        return response.data;
    };

    const getScheduledMeetings = async (): Promise<any> => {
        const response = await meetingsClient.get("/scheduled");
        return response.data.meetings;
    };

    const data = {
        userData,
        setUserData,
        addToUserHistory,
        getHistoryOfUser,
        handleRegister,
        handleLogin,
        handleLogout,
        scheduleMeeting,
        getScheduledMeetings,
    };

    return <AuthContext.Provider value={data}>{children}</AuthContext.Provider>;
};

export default AuthContext;
