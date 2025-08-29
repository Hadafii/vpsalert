import React from "react";
import Layout from "./layouts/MainLayout";
import Hero from "./components/Hero";
import Monitor from "./components/Monitor";
const page = () => {
  return (
    <>
      <Layout>
        <Hero />
        <Monitor />
      </Layout>
    </>
  );
};

export default page;
