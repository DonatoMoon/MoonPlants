import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import logo from "@/public/logo.png"
import Container from '@/components/layout/Container';


export default function Footer() {
    return (
        <footer className="bg-[#21261B] py-10">
            <Container>
            <div
                className="flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
                <div>
                    <div className="flex items-center gap-2 mb-6">
                        <Image
                            src={logo}
                            alt="MoonPlants logo"
                            width={32}
                            height={32}
                            draggable={false}
                        />
                        <span className="font-bold text-lg">MoonPlants</span>
                    </div>
                    <p className="max-w-xs mb-8 opacity-90 text-sm">
                        MoonPlants helps you keep your indoor plants healthy and happy.
                        Monitor soil moisture, temperature, and light — all in one place!
                    </p>
                    <div className="flex gap-8 font-bold">
                        <a href="#" className="hover:text-green-300 transition">FB</a>
                        <a href="#" className="hover:text-green-300 transition">TW</a>
                        <a href="#" className="hover:text-green-300 transition">LI</a>
                    </div>
                </div>

                <div className="w-full md:w-auto flex flex-col items-start md:items-end gap-8">
                    <div>
                        <div className="font-bold mb-2">For Every Update.</div>
                        <form className="flex items-center">
                            <Input
                                type="email"
                                placeholder="Enter Email"
                                required
                                className=" mr-5"
                            />
                            <Button
                                type="submit"
                                variant="outline"
                            >
                                SUBSCRIBE
                            </Button>
                        </form>
                    </div>
                    <span className="mt-6 text-sm opacity-80">
              MoonPlants © all right reserve
            </span>
                </div>
            </div>
            </Container>
        </footer>
    );
}
