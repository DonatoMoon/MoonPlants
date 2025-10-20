import {createSupabaseServer} from "@/lib/supabase/server";

import HeroSection from "@/components/sections/hero/HeroSection";
import AboutSection from "@/components/sections/about/AboutSection";
import FAQSection from "@/components/sections/faq/FAQSection";
import FeedbackSection from "@/components/sections/feedback/FeedbackSection";
import BackgroundImageContainer from '@/components/layout/BackgroundImageContainer'
import Container from '@/components/layout/Container'

import backImg from "@/public/backImg.png";


export default async function Home() {
    const supabase = await createSupabaseServer();
    const {data: {user}} = await supabase.auth.getUser();

    return (
        <>
            <BackgroundImageContainer src={backImg}>
                <Container>
                    <HeroSection user={user}/>
                    <AboutSection/>
                    <FAQSection/>
                </Container>
            </BackgroundImageContainer>
            <FeedbackSection/>
        </>
    );
}
