"use client";

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    fetchMyPosts,
    fetchProfile,
    getErrorMessage,
    hasClientSession,
    restorePostToDraft,
    submitPostForReview,
    type AuthUser,
    type Post,
    type PostStatus,
    updateProfile,
} from '@/lib/api';
import ProfileForm from './ProfileForm';
import ProfilePostsPanel from './ProfilePostsPanel';

export default function ProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<AuthUser>({ id: 0, username: '', email: '', is_staff: false, is_superuser: false });
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<PostStatus | 'all'>('all');
    const [workflowBusyId, setWorkflowBusyId] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const loadProfileData = useCallback(async () => {
        const [profileData, postData] = await Promise.all([fetchProfile(), fetchMyPosts()]);
        setProfile(profileData);
        setPosts(postData);
    }, []);

    useEffect(() => {
        if (!hasClientSession()) {
            router.push('/login');
            return;
        }

        loadProfileData()
            .then(() => setLoading(false))
            .catch((requestError: unknown) => {
                setError(getErrorMessage(requestError, 'Failed to load profile data.'));
                setLoading(false);
            });
    }, [loadProfileData, router]);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        try {
            await updateProfile({ username: profile.username, email: profile.email });
            setSuccess('Profile updated successfully.');
            router.refresh();
        } catch (updateError: unknown) {
            setError(getErrorMessage(updateError, 'Failed to update profile.'));
        }
    };

    const handleWorkflowAction = async (postId: number, action: 'submit' | 'restore') => {
        setError('');
        setSuccess('');
        setWorkflowBusyId(postId);

        try {
            if (action === 'submit') {
                await submitPostForReview(postId);
                setSuccess('Post submitted for review.');
            } else {
                await restorePostToDraft(postId);
                setSuccess('Post restored to draft.');
            }
            await loadProfileData();
        } catch (workflowError: unknown) {
            setError(
                getErrorMessage(
                    workflowError,
                    action === 'submit' ? 'Failed to submit the post for review.' : 'Failed to restore the post to draft.',
                ),
            );
        } finally {
            setWorkflowBusyId(null);
        }
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Loading profile...</div>;
    }

    return (
        <div className="container" style={{ maxWidth: '960px', margin: '40px auto', display: 'grid', gap: '24px' }}>
            <ProfileForm
                profile={profile}
                error={error}
                success={success}
                onSubmit={handleSubmit}
                onChange={setProfile}
            />

            <ProfilePostsPanel
                posts={posts}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                workflowBusyId={workflowBusyId}
                onWorkflowAction={(postId, action) => void handleWorkflowAction(postId, action)}
            />
        </div>
    );
}
