const Spinner = () => {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center">
      <span className="inline-flex h-8 w-8 animate-ping items-center justify-center rounded-full bg-slate-400 opacity-75">
        <span className="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-slate-200 opacity-75"></span>
      </span>
    </div>
  );
};

export default Spinner;
