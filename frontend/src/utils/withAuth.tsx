import React, { useEffect, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";

export const withAuth = <P extends object>(WrappedComponent: ComponentType<P>) => {
    const AuthComponent: React.FC<P> = (props) => {
        const router = useNavigate();

        const isAuthenticated = (): boolean => {
            if (localStorage.getItem("token")) {
                return true;
            }
            return false;
        };

        useEffect(() => {
            if (!isAuthenticated()) {
                router("/auth");
            }
        }, [router]);

        return <WrappedComponent {...props} />;
    };

    return AuthComponent;
};

export default withAuth;
