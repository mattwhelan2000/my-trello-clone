import { Navbar } from "@/components/Navbar";

const PlatformLayout = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="h-full">
            <Navbar />
            <main className="pt-40 md:pt-40 px-4 max-w-6xl mx-auto md:px-6"> {/* Generic container, we'll override this in board layout */}
                {children}
            </main>
        </div>
    );
};

export default PlatformLayout;
