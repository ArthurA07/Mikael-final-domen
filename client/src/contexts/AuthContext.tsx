import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { config } from '../config';

// Типы данных
interface User {
  _id: string;
  name: string;
  email: string;
  role?: 'user' | 'admin';
  phone?: string;
  avatar?: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  trainerSettings: any;
  stats: any;
  achievements: any[];
  preferences: {
    theme: 'light' | 'dark';
    language: 'ru' | 'en';
    fontSize: 'small' | 'medium' | 'large';
  };
  createdAt: string;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  register: (userData: RegisterData) => Promise<boolean>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

// Создаём контекст
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Хук для использования контекста
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Настройка axios
axios.defaults.baseURL = config.API_BASE_URL;
// Подхватываем токен сразу при инициализации (до эффектов)
try {
  const bootstrapToken = localStorage.getItem('token');
  if (bootstrapToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${bootstrapToken}`;
  }
} catch {}

// Провайдер контекста
interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  // Устанавливаем токен в заголовки axios при его изменении
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      localStorage.setItem('token', token);
    } else {
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  }, [token]);

  // Загружаем пользователя при наличии токена
  useEffect(() => {
    const loadUser = async () => {
      if (token) {
        try {
          const response = await axios.get('/auth/me');
          setUser(response.data.data.user);
        } catch (error) {
          console.error('Error loading user:', error);
          // Если токен недействительный, очищаем его
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };

    loadUser();
  }, [token]);

  // Функция входа
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await axios.post('/auth/login', { email, password });
      
      if (response.data.success) {
        const { token: newToken, user: userData } = response.data.data;
        // Ставим заголовок немедленно, чтобы следующие запросы не успели уйти без токена
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        setToken(newToken);
        setUser(userData);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Login error:', error);
      const msg =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка входа';
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Функция регистрации
  const register = async (userData: RegisterData): Promise<boolean> => {
    try {
      setIsLoading(true);
      const response = await axios.post('/auth/register', userData);
      
      if (response.data.success) {
        const { token: newToken, user: newUser } = response.data.data;
        axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        setToken(newToken);
        setUser(newUser);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Registration error:', error);
      const msg =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        'Ошибка регистрации';
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Функция выхода
  const logout = () => {
    setToken(null);
    setUser(null);
  };

  // Функция обновления данных пользователя
  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 