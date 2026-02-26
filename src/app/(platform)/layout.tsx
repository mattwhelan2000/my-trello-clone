import { Navbar } from "@/components/Navbar";

const PlatformLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="h-full">
            <Navbar />
            <main className="pt-14 md:pt-14 h-full">
                {children}
            </main>
        </div>
    );
};

export default PlatformLayout;
