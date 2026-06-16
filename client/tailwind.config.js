export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#1B4D3E",
        warning: "#E07B00",
        danger: "#C0392B",
        safe: "#27AE60",
        background: "#F5F7F2",
        text: "#1A1A1A"
      },
      boxShadow: {
        panel: "0 10px 30px rgba(26, 26, 26, 0.08)"
      }
    }
  },
  plugins: []
};

