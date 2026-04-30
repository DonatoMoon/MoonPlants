'use client';

import { useTranslations } from 'next-intl';
import { BackgroundScene } from '@/components/layout/BackgroundScene';
import Container from '@/components/layout/Container';
import { PageHeader } from '@/components/primitives/PageHeader';
import {
    MeasurementsSkeleton,
    DevicesSectionSkeleton,
    PlantsGridSkeleton,
} from '@/components/profile/skeletons';

export default function ProfileLoading() {
    const t = useTranslations('ProfilePage');
    return (
        <BackgroundScene variant="profile">
            <Container className="flex-1 py-8 md:py-12">
                <PageHeader title={t('title')} subtitle={t('subtitle')} />
                <MeasurementsSkeleton />
                <DevicesSectionSkeleton />
                <PlantsGridSkeleton />
            </Container>
        </BackgroundScene>
    );
}
