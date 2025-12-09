import { Routes } from '@angular/router';
import { UserDashboardComponent } from './components/user-dashboard/user-dashboard';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard';

export const routes: Routes = [
    { path: '', component: UserDashboardComponent },
    { path: 'admin', component: AdminDashboardComponent },
    { path: '**', redirectTo: '' }
];
