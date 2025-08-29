import React from "react";
import ManageTokenPage from "../components/ManageToken";

interface PageProps {
  params: Promise<{ token: string }>;
}

const page = ({ params }: PageProps) => {
  return <ManageTokenPage params={params} />;
};

export default page;
