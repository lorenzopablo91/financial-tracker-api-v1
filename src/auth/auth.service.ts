import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AuthService {
    private supabase;

    constructor(private prisma: PrismaService) {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Environment variables SUPABASE_URL and SUPABASE_ANON_KEY must be defined');
        }
        this.supabase = createClient(supabaseUrl, supabaseAnonKey);
    }

    async login(email: string, password: string) {
        const { data, error } = await this.supabase.auth.signInWithPassword({
            email,
            password
        });

        if (data.user) {
            const user = await this.prisma.user.findUnique({
                where: { id: data.user.id },
                select: {
                    role: true,
                    fullName: true
                }
            });
            data.user.role = user?.role;
            data.user.fullName = user?.fullName;
        }

        return { data, error };
    }

    async refreshToken(refreshToken: string) {
        const { data, error } = await this.supabase.auth.refreshSession({
            refresh_token: refreshToken
        });

        if (data.user) {
            const user = await this.prisma.user.findUnique({
                where: { id: data.user.id },
                select: {
                    role: true,
                    fullName: true
                }
            });
            data.user.role = user?.role;
            data.user.fullName = user?.fullName;
        }

        return { data, error };
    }

    async logout(accessToken: string) {
        await this.supabase.auth.signOut();
    }
}