/// <reference types="react-scripts" />

interface Window {
  localStream?: any;
}

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.css";
declare module "*.svg";
declare module "*.png";
