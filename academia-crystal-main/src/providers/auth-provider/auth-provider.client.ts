"use client";

import { AuthBindings } from "@refinedev/core";
import { supabaseBrowserClient } from "@utils/supabase/client";

// IMPORTANTE: Aquí usamos 'export const' para que el Layout pueda encontrarlo con { }
export const authProvider: AuthBindings = {
  login: async ({ email, password }) => {
    const { error } = await supabaseBrowserClient.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        error: {
          name: "LoginError",
          message: error.message,
        },
      };
    }

    return {
      success: true,
      redirectTo: "/",
    };
  },
  logout: async () => {
    const { error } = await supabaseBrowserClient.auth.signOut();
    if (error) {
      return {
        success: false,
        error,
      };
    }
    return {
      success: true,
      redirectTo: "/login",
    };
  },
  check: async () => {
    const { data } = await supabaseBrowserClient.auth.getSession();
    const { session } = data;

    if (!session) {
      return {
        authenticated: false,
        redirectTo: "/login",
      };
    }

    return {
      authenticated: true,
    };
  },
  onError: async (error) => {
    console.error(error);
    return { error };
  },
};