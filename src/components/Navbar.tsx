import Link from "next/link";
import { LayoutDashboard, Plus } from "lucide-react";

export const Navbar = () => {
    return (
        <nav className="fixed z-50 top-0 px-4 w-full h-14 border-b shadow-sm bg-white flex items-center">
            <div className="flex items-center gap-x-4">
                <div className="hidden md:flex">
                    <Link href="/">
                        <div className="hover:opacity-75 transition items-center gap-x-2 hidden md:flex cursor-pointer">
                            <div className="bg-blue-600 p-1 rounded-sm">
                                <LayoutDashboard className="h-5 w-5 text-white" />
                            </div>
                            <p className="text-lg text-neutral-700 font-bold pb-1 text-center">
                                Trello Clone
                            </p>
                        </div>
                    </Link>
                </div>
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition h-auto rounded-sm md:block">
                    <span className="md:hidden">
                        <Plus className="h-4 w-4" />
                    </span>
                    <span className="hidden md:block">Create</span>
                </button>
            </div>
            <div className="ml-auto flex items-center gap-x-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold cursor-pointer">
                    U
                </div>
            </div>
        </nav>
    );
};
